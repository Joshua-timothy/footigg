import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { COMPETITIONS, SYNC } from "@/lib/constants";
import { flags } from "@/lib/env";
import { footballDataFetch } from "@/lib/football-data/client";
import { mapCompetition, mapMatch, seasonStartYear } from "@/lib/football-data/mapper";
import { getBudgetState, pruneApiRequests } from "@/lib/football-data/budget";
import type { FdCompetitionsResponse, FdMatchesResponse } from "@/lib/football-data/types";
import { PredictionFactory } from "@/lib/data/prediction-factory";
import { loadMatchWindow } from "@/lib/data/match-window";
import { toPredictionCreate } from "@/lib/data/mappers";
import { isUpcoming, scorePrediction } from "@/lib/prediction";
import type { CompetitionCode, MatchRecord } from "@/types/domain";

const COMPETITION_CACHE_KEY = "competitions:v4";

export interface SyncResult {
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  runId: string | null;
  reason?: string;
  matchesSeen: number;
  matchesSaved: number;
  predictions: number;
  resolved: number;
  requests: number;
}

function emptyResult(status: SyncResult["status"], reason?: string): SyncResult {
  return {
    status,
    runId: null,
    reason,
    matchesSeen: 0,
    matchesSaved: 0,
    predictions: 0,
    resolved: 0,
    requests: 0,
  };
}

/**
 * Cross-instance mutex. A single row is claimed for five minutes using an
 * atomic upsert, so two cold serverless instances can never sync at once.
 */
async function acquireLock(owner: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "SyncLock" ("id", "owner", "acquiredAt", "expiresAt")
    VALUES ('global', ${owner}, now(), now() + interval '5 minutes')
    ON CONFLICT ("id") DO UPDATE
      SET "owner" = EXCLUDED."owner",
          "acquiredAt" = now(),
          "expiresAt" = EXCLUDED."expiresAt"
      WHERE "SyncLock"."expiresAt" < now()
    RETURNING "id"
  `;
  return rows.length > 0;
}

async function releaseLock(owner: string): Promise<void> {
  await prisma.syncLock.deleteMany({ where: { id: "global", owner } });
}

/** Competition names/emblems change rarely â€” cache them for a week. */
async function loadCompetitionMeta() {
  const now = new Date();
  try {
    const cached = await prisma.apiCache.findUnique({ where: { key: COMPETITION_CACHE_KEY } });
    if (cached && cached.expiresAt > now) {
      return (cached.payload as unknown as FdCompetitionsResponse).competitions ?? [];
    }
  } catch {
    // fall through to the network
  }

  const response = await footballDataFetch<FdCompetitionsResponse>("/competitions");
  const expiresAt = new Date(now.getTime() + SYNC.competitionMetaTtlMinutes * 60_000);
  const payload = response as unknown as Prisma.InputJsonValue;
  await prisma.apiCache
    .upsert({
      where: { key: COMPETITION_CACHE_KEY },
      update: { payload, fetchedAt: now, expiresAt },
      create: { key: COMPETITION_CACHE_KEY, payload, expiresAt },
    })
    .catch(() => undefined);

  return response.competitions ?? [];
}

async function upsertCompetitions() {
  const remote = await loadCompetitionMeta();
  const byCode = new Map(remote.map((competition) => [competition.code, competition]));

  const rows = COMPETITIONS.map((competition, index) => {
    const live = byCode.get(competition.code);
    const mapped = live ? mapCompetition(live) : null;
    return Prisma.sql`(
      ${competition.code},
      ${mapped?.name ?? competition.name},
      ${competition.shortName},
      ${competition.country},
      ${mapped?.emblem ?? competition.emblem},
      ${index},
      ${true},
      NOW()
    )`;
  });

  await prisma.$executeRaw`
    INSERT INTO "Competition" ("code", "name", "shortName", "country", "emblem", "sortOrder", "isTracked", "updatedAt")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("code") DO UPDATE SET
      "name" = EXCLUDED."name",
      "shortName" = EXCLUDED."shortName",
      "country" = EXCLUDED."country",
      "emblem" = EXCLUDED."emblem",
      "sortOrder" = EXCLUDED."sortOrder",
      "isTracked" = EXCLUDED."isTracked",
      "updatedAt" = NOW()
  `;

  return remote;
}

/** Date-only key offset from an instant. */
function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * football-data.org's free plan rejects /matches windows longer than 10 days.
 * A normal sync therefore walks four short windows: the last 9 days for results,
 * then 21 days ahead for fixtures. Four requests stay inside the 8/minute guard.
 */
function buildSyncWindows(now: Date): Array<{ from: string; to: string }> {
  const day = 86_400_000;
  return [
    { from: dateKey(now.getTime() - 9 * day), to: dateKey(now.getTime()) },
    { from: dateKey(now.getTime()), to: dateKey(now.getTime() + 9 * day) },
    { from: dateKey(now.getTime() + 9 * day), to: dateKey(now.getTime() + 18 * day) },
    { from: dateKey(now.getTime() + 18 * day), to: dateKey(now.getTime() + 21 * day) },
  ];
}

/** Backfill-only helper: sleeps when the per-minute budget is exhausted. */
async function waitForBudget(context: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const budget = await getBudgetState();
    if (budget.remaining > 0) return;
    console.log(
      `[sync] ${context}: rate limit guard (${budget.used}/${budget.budget}); waiting 61s`,
    );
    await new Promise((resolve) => setTimeout(resolve, 61_000));
  }
  throw new Error("football-data.org budget did not recover");
}

const WRITE_CHUNK = 400;

/**
 * One statement per chunk instead of one round trip per row.
 *
 * The Supabase pooler adds latency to every statement, so the original
 * per-row upsert took minutes for a season and could exceed a serverless
 * function's lifetime. A multi-row INSERT ... ON CONFLICT keeps a full sync
 * well inside a single request budget.
 */
async function upsertTeams(teams: MatchRecord["homeTeam"][]): Promise<void> {
  const rows = teams.map(
    (team) => Prisma.sql`(${team.id}, ${team.name}, ${team.shortName}, ${team.tla}, ${team.crest}, NOW())`,
  );

  for (let index = 0; index < rows.length; index += WRITE_CHUNK) {
    await prisma.$executeRaw`
      INSERT INTO "Team" ("id", "name", "shortName", "tla", "crest", "updatedAt")
      VALUES ${Prisma.join(rows.slice(index, index + WRITE_CHUNK))}
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "shortName" = EXCLUDED."shortName",
        "tla" = EXCLUDED."tla",
        "crest" = EXCLUDED."crest",
        "updatedAt" = NOW()
    `;
  }
}

async function upsertMatches(records: MatchRecord[]): Promise<void> {
  const rows = records.map((record) => {
    const totalGoals =
      record.score.home !== null && record.score.away !== null
        ? record.score.home + record.score.away
        : null;

    return Prisma.sql`(
      ${record.id},
      ${record.competitionCode},
      ${record.season},
      ${record.matchday},
      ${record.stage},
      ${new Date(record.kickoff)},
      ${record.status}::"MatchStatus",
      ${record.homeTeam.id},
      ${record.awayTeam.id},
      ${record.score.home},
      ${record.score.away},
      ${record.score.htHome},
      ${record.score.htAway},
      ${record.winner}::"Winner",
      ${record.btts},
      ${totalGoals},
      NOW(),
      NOW()
    )`;
  });

  for (let index = 0; index < rows.length; index += WRITE_CHUNK) {
    await prisma.$executeRaw`
      INSERT INTO "Match" (
        "id", "competitionCode", "season", "matchday", "stage", "kickoff",
        "status", "homeTeamId", "awayTeamId", "homeGoals", "awayGoals",
        "htHomeGoals", "htAwayGoals", "winner", "btts", "totalGoals",
        "lastSyncedAt", "updatedAt"
      )
      VALUES ${Prisma.join(rows.slice(index, index + WRITE_CHUNK))}
      ON CONFLICT ("id") DO UPDATE SET
        "competitionCode" = EXCLUDED."competitionCode",
        "season" = EXCLUDED."season",
        "matchday" = EXCLUDED."matchday",
        "stage" = EXCLUDED."stage",
        "kickoff" = EXCLUDED."kickoff",
        "status" = EXCLUDED."status",
        "homeTeamId" = EXCLUDED."homeTeamId",
        "awayTeamId" = EXCLUDED."awayTeamId",
        "homeGoals" = EXCLUDED."homeGoals",
        "awayGoals" = EXCLUDED."awayGoals",
        "htHomeGoals" = EXCLUDED."htHomeGoals",
        "htAwayGoals" = EXCLUDED."htAwayGoals",
        "winner" = EXCLUDED."winner",
        "btts" = EXCLUDED."btts",
        "totalGoals" = EXCLUDED."totalGoals",
        "lastSyncedAt" = EXCLUDED."lastSyncedAt",
        "updatedAt" = NOW()
    `;
  }
}

async function upsertTeamsAndMatches(records: MatchRecord[]): Promise<number> {
  if (records.length === 0) return 0;

  const teams = new Map<number, MatchRecord["homeTeam"]>();
  for (const record of records) {
    teams.set(record.homeTeam.id, record.homeTeam);
    teams.set(record.awayTeam.id, record.awayTeam);
  }

  await upsertTeams(Array.from(teams.values()));

  const ids = records.map((record) => record.id);
  const existing = await prisma.match.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      homeGoals: true,
      awayGoals: true,
      kickoff: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const toCreate: MatchRecord[] = [];
  const toUpdate: MatchRecord[] = [];

  for (const record of records) {
    const row = existingById.get(record.id);
    if (!row) {
      toCreate.push(record);
      continue;
    }
    if (
      row.status !== record.status ||
      row.homeGoals !== record.score.home ||
      row.awayGoals !== record.score.away ||
      row.homeTeamId !== record.homeTeam.id ||
      row.awayTeamId !== record.awayTeam.id ||
      row.kickoff.getTime() !== new Date(record.kickoff).getTime()
    ) {
      toUpdate.push(record);
    }
  }

  // Only changed rows are written. A first backfill changes everything; a
  // normal sync touches a handful of results and kick-off times.
  const toUpsert = [...toCreate, ...toUpdate];
  if (toUpsert.length > 0) await upsertMatches(toUpsert);

  // Remember which season each competition is currently in. One statement
  // instead of one round trip per competition per sync window.
  const seasons = new Map<string, number>();
  for (const record of records) {
    const current = seasons.get(record.competitionCode) ?? 0;
    if (record.season > current) seasons.set(record.competitionCode, record.season);
  }
  if (seasons.size > 0) {
    const values = Array.from(seasons).map(
      ([code, season]) => Prisma.sql`(${code}, ${season})`,
    );
    await prisma.$executeRaw`
      UPDATE "Competition" AS c
      SET "season" = v.season, "updatedAt" = NOW()
      FROM (VALUES ${Prisma.join(values)}) AS v(code, season)
      WHERE c."code" = v.code
    `;
  }

  return toUpsert.length;
}

async function createUpcomingPredictions(now: Date): Promise<number> {
  const history = await loadMatchWindow(now);
  const upcoming = history.filter(
    (match) =>
      isUpcoming(match) &&
      new Date(match.kickoff).getTime() > now.getTime() &&
      new Date(match.kickoff).getTime() < now.getTime() + SYNC.lookaheadDays * 86_400_000,
  );
  if (upcoming.length === 0) return 0;

  const existing = await prisma.prediction.findMany({
    where: { matchId: { in: upcoming.map((match) => match.id) } },
    select: { matchId: true },
  });
  const existingIds = new Set(existing.map((row) => row.matchId));
  const missing = upcoming.filter((match) => !existingIds.has(match.id));
  if (missing.length === 0) return 0;

  const competitions = await prisma.competition.findMany();
  const competitionMap = new Map(
    COMPETITIONS.map((competition) => [competition.code, competition]),
  );
  for (const row of competitions) {
    const code = row.code as CompetitionCode;
    const base = competitionMap.get(code);
    if (base) {
      competitionMap.set(code, {
        ...base,
        name: row.name,
        emblem: row.emblem,
        season: row.season,
      });
    }
  }

  const factory = new PredictionFactory(history, { asOf: now, competitions: competitionMap });
  const data = missing.map((match) => toPredictionCreate(match.id, factory.predict(match)));

  const chunkSize = 50;
  for (let index = 0; index < data.length; index += chunkSize) {
    await prisma.prediction.createMany({
      data: data.slice(index, index + chunkSize),
      skipDuplicates: true,
    });
  }

  return data.length;
}

async function resolveFinishedPredictions(): Promise<number> {
  const rows = await prisma.prediction.findMany({
    where: { resolvedAt: null, match: { status: "FINISHED", btts: { not: null } } },
    include: { match: true },
    take: 200,
  });
  if (rows.length === 0) return 0;

  const resolvedAt = new Date();
  const values = rows.map((row) => {
    const actual = Boolean(row.match.btts);
    const scored = scorePrediction(row.probabilityYes, actual);
    return Prisma.sql`(
      ${row.id},
      ${resolvedAt},
      ${actual},
      ${scored.correct},
      ${scored.brier},
      ${scored.logLoss}
    )`;
  });

  // One statement for the whole batch: a settled matchday can resolve dozens of
  // picks, and the pooler makes per-row updates expensive.
  await prisma.$executeRaw`
    UPDATE "Prediction" AS p
    SET
      "resolvedAt" = v."resolvedAt"::timestamptz,
      "actualBtts" = v."actualBtts"::boolean,
      "correct" = v."correct"::boolean,
      "brier" = v."brier"::double precision,
      "logLoss" = v."logLoss"::double precision,
      "updatedAt" = NOW()
    FROM (VALUES ${Prisma.join(values)}) AS v(id, "resolvedAt", "actualBtts", "correct", "brier", "logLoss")
    WHERE p."id" = v.id::text
  `;

  return rows.length;
}

async function prune(): Promise<void> {
  const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000);
  await Promise.allSettled([
    pruneApiRequests(),
    prisma.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.prediction.deleteMany({
      where: { resolvedAt: { not: null, lt: twoYearsAgo } },
    }),
    prisma.syncRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } }),
  ]);
}

export async function runSync(options: {
  trigger: string;
}): Promise<SyncResult> {
  if (!flags.database || !flags.api) {
    return emptyResult("SKIPPED", "Database or football-data.org key is not configured");
  }

  const windows = buildSyncWindows(new Date());
  const budget = await getBudgetState();
  if (budget.remaining < windows.length + 1) {
    return emptyResult(
      "SKIPPED",
      `Rate limit guard: ${budget.used} requests in the last minute, ${windows.length + 1} needed`,
    );
  }

  const owner = randomUUID();
  const locked = await acquireLock(owner);
  if (!locked) return emptyResult("SKIPPED", "Another sync is already running");

  const run = await prisma.syncRun.create({
    data: { trigger: options.trigger, status: "RUNNING" },
  });

  let requests = 0;
  let matchesSeen = 0;
  let matchesSaved = 0;
  let predictions = 0;
  let resolved = 0;

  try {
    const now = new Date();
    await upsertCompetitions();
    requests += 1;

    const competitionCodes = COMPETITIONS.map((competition) => competition.code).join(",");
    const collected = new Map<number, MatchRecord>();

    for (const window of windows) {
      const response = await footballDataFetch<FdMatchesResponse>("/matches", {
        params: {
          competitions: competitionCodes,
          dateFrom: window.from,
          dateTo: window.to,
        },
      });
      requests += 1;

      for (const record of (response.matches ?? []).map(mapMatch)) {
        if (record) collected.set(record.id, record);
      }
    }

    // Boundary days appear in two windows, so dedupe by fixture id. Writing all
    // four windows in one pass keeps the sync to a handful of round trips.
    const records = Array.from(collected.values());
    matchesSeen = records.length;
    matchesSaved = await upsertTeamsAndMatches(records);

    predictions = await createUpcomingPredictions(now);
    resolved = await resolveFinishedPredictions();
    await prune();

    const budget = await getBudgetState();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        matchesSeen,
        matchesSaved,
        predictions,
        resolved,
        requests,
        detail: {
          windows,
          budget: {
            used: budget.used,
            budget: budget.budget,
            remaining: budget.remaining,
            retryInMs: budget.retryInMs,
          },
        },
      },
    });

    return {
      status: "SUCCESS",
      runId: run.id,
      matchesSeen,
      matchesSaved,
      predictions,
      resolved,
      requests,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await prisma.syncRun
      .update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          matchesSeen,
          matchesSaved,
          predictions,
          resolved,
          requests,
          error: message.slice(0, 500),
        },
      })
      .catch(() => undefined);

    return {
      ...emptyResult("FAILED", message),
      runId: run.id,
      matchesSeen,
      matchesSaved,
      predictions,
      resolved,
      requests,
    };
  } finally {
    await releaseLock(owner).catch(() => undefined);
  }
}

/**
 * One-time history load.
 *
 * The free plan limits /matches to 10-day windows, but the season endpoint
 * returns a whole season in one request. We load the current and previous
 * season for all ten competitions (20 requests), sleeping between batches when
 * the 8/minute guard is reached. Run this from the CLI (`npm run backfill`),
 * never from a serverless request.
 */
export async function backfillSeasonHistory(options: { trigger: string }): Promise<SyncResult> {
  if (!flags.database || !flags.api) {
    return emptyResult("SKIPPED", "Database or football-data.org key is not configured");
  }

  const owner = randomUUID();
  const locked = await acquireLock(owner);
  if (!locked) return emptyResult("SKIPPED", "Another sync is already running");

  const run = await prisma.syncRun.create({
    data: { trigger: options.trigger, status: "RUNNING" },
  });

  let requests = 0;
  let matchesSeen = 0;
  let matchesSaved = 0;
  let predictions = 0;
  let resolved = 0;

  try {
    const remote = await upsertCompetitions();
    requests += 1;

    const byCode = new Map(remote.map((competition) => [competition.code, competition]));
    const currentYear = new Date().getUTCFullYear();
    const targets: Array<{ code: CompetitionCode; season: number }> = [];

    for (const competition of COMPETITIONS) {
      const live = byCode.get(competition.code);
      const fallback =
        competition.code === "BSA" || new Date().getUTCMonth() >= 6
          ? currentYear
          : currentYear - 1;
      const current = seasonStartYear(live?.currentSeason?.startDate, fallback);
      targets.push({ code: competition.code, season: current });
      targets.push({ code: competition.code, season: current - 1 });
    }

    for (const target of targets) {
      await waitForBudget(`${target.code} ${target.season}`);
      const response = await footballDataFetch<FdMatchesResponse>(
        `/competitions/${target.code}/matches`,
        { params: { season: target.season } },
      );
      requests += 1;

      const records = (response.matches ?? [])
        .map(mapMatch)
        .filter((record): record is MatchRecord => Boolean(record));

      matchesSeen += records.length;
      matchesSaved += await upsertTeamsAndMatches(records);
    }

    predictions = await createUpcomingPredictions(new Date());
    resolved = await resolveFinishedPredictions();
    await prune();

    const budget = await getBudgetState();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        matchesSeen,
        matchesSaved,
        predictions,
        resolved,
        requests,
        detail: {
          seasons: targets,
          budget: {
            used: budget.used,
            budget: budget.budget,
            remaining: budget.remaining,
            retryInMs: budget.retryInMs,
          },
        },
      },
    });

    return {
      status: "SUCCESS",
      runId: run.id,
      matchesSeen,
      matchesSaved,
      predictions,
      resolved,
      requests,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backfill error";
    await prisma.syncRun
      .update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          matchesSeen,
          matchesSaved,
          predictions,
          resolved,
          requests,
          error: message.slice(0, 500),
        },
      })
      .catch(() => undefined);

    return {
      ...emptyResult("FAILED", message),
      runId: run.id,
      matchesSeen,
      matchesSaved,
      predictions,
      resolved,
      requests,
    };
  } finally {
    await releaseLock(owner).catch(() => undefined);
  }
}

/**
 * Cheap guard used by page renders: only sync if the last successful run is
 * older than the configured interval. Never throws.
 */
export async function maybeLazySync(trigger = "lazy"): Promise<SyncResult> {
  if (!flags.database || !flags.api) {
    return emptyResult("SKIPPED", "Live mode is not configured");
  }

  try {
    const last = await prisma.syncRun.findFirst({
      where: { status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });

    if (last && Date.now() - last.startedAt.getTime() < SYNC.minIntervalMinutes * 60_000) {
      return emptyResult("SKIPPED", "Recently synced");
    }

    return await runSync({ trigger });
  } catch (error) {
    return emptyResult(
      "SKIPPED",
      error instanceof Error ? error.message : "Lazy sync failed",
    );
  }
}


import { prisma } from "@/lib/db/prisma";
import { COMPETITION_BY_CODE, COMPETITIONS, MODEL, SYNC } from "@/lib/constants";
import { flags } from "@/lib/env";
import { toDateKey } from "@/lib/format";
import { getBudgetState } from "@/lib/football-data/budget";
import { isTrackedCompetition } from "@/lib/football-data/mapper";
import {
  buildCalibration,
  calibrationError,
  isFinished,
  scorePrediction,
} from "@/lib/prediction";
import { PredictionFactory } from "@/lib/data/prediction-factory";
import { hydratePrediction, toMatchRecord, toPredictionCreate } from "@/lib/data/mappers";
import type { StoredPredictionInputs } from "@/lib/data/mappers";
import { applyFilters, statsFor, type FootballRepository } from "@/lib/data/repository";
import { buildLeagueOverviews } from "@/lib/data/overview";
import type {
  Board,
  BoardFilters,
  CompetitionCode,
  CompetitionMeta,
  FixturePrediction,
  LeagueAccuracy,
  LeagueOverview,
  MatchDetail,
  PerformanceReport,
  Prediction,
  ResolvedPrediction,
  SyncRunSummary,
  SyncStatus,
} from "@/types/domain";

const HISTORY_MS = MODEL.historyDays * 86_400_000;
const LOOKAHEAD_MS = SYNC.lookaheadDays * 86_400_000;

export class PrismaRepository implements FootballRepository {
  readonly source = "live" as const;

  async getCompetitions(): Promise<CompetitionMeta[]> {
    try {
      const rows = await prisma.competition.findMany({ orderBy: { sortOrder: "asc" } });
      if (rows.length === 0) return COMPETITIONS.map((competition) => ({ ...competition }));

      return rows
        .filter((row) => isTrackedCompetition(row.code))
        .map((row) => {
          const base = COMPETITION_BY_CODE[row.code as CompetitionCode];
          return {
            ...base,
            name: row.name || base.name,
            shortName: row.shortName || base.shortName,
            country: row.country ?? base.country,
            emblem: row.emblem ?? base.emblem,
            season: row.season,
          };
        });
    } catch (error) {
      console.warn("[repository] competition lookup failed, using constants", error);
      return COMPETITIONS.map((competition) => ({ ...competition }));
    }
  }

  private async loadWindow(now: Date) {
    const rows = await prisma.match.findMany({
      where: {
        kickoff: {
          gte: new Date(now.getTime() - HISTORY_MS),
          lte: new Date(now.getTime() + LOOKAHEAD_MS),
        },
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoff: "asc" },
    });
    return rows.map(toMatchRecord);
  }

  private async lastSyncRun(): Promise<SyncRunSummary | null> {
    try {
      const row = await prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } });
      if (!row) return null;
      return {
        id: row.id,
        trigger: row.trigger,
        status: row.status,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        matchesSeen: row.matchesSeen,
        matchesSaved: row.matchesSaved,
        predictions: row.predictions,
        resolved: row.resolved,
        requests: row.requests,
        error: row.error,
      };
    } catch {
      return null;
    }
  }

  private async lastSuccessAt(): Promise<string | null> {
    try {
      const row = await prisma.syncRun.findFirst({
        where: { status: { in: ["SUCCESS", "PARTIAL"] } },
        orderBy: { startedAt: "desc" },
        select: { finishedAt: true, startedAt: true },
      });
      return (row?.finishedAt ?? row?.startedAt)?.toISOString() ?? null;
    } catch {
      return null;
    }
  }

  async getBoard(filters: BoardFilters): Promise<Board> {
    const now = new Date();
    const [matches, competitions, lastSuccessAt] = await Promise.all([
      this.loadWindow(now),
      this.getCompetitions(),
      this.lastSuccessAt(),
    ]);

    const competitionMap = new Map(
      competitions.map((competition) => [competition.code, competition]),
    );
    const onDate = matches.filter((match) => toDateKey(match.kickoff) === filters.date);
    const ids = onDate.map((match) => match.id);

    const storedRows = ids.length
      ? await prisma.prediction.findMany({ where: { matchId: { in: ids } } })
      : [];
    const storedByMatch = new Map(storedRows.map((row) => [row.matchId, row]));

    const factory = new PredictionFactory(matches, { asOf: now, competitions: competitionMap });
    const toPersist: ReturnType<typeof toPredictionCreate>[] = [];

    const fixtures: FixturePrediction[] = onDate.map((match) => {
      const competition =
        competitionMap.get(match.competitionCode) ?? COMPETITION_BY_CODE[match.competitionCode];
      const stored = storedByMatch.get(match.id);

      if (stored) {
        return {
          match,
          competition,
          persisted: true,
          prediction: hydratePrediction(
            stored,
            {
              home: factory.formFor(match.homeTeam.id, match.homeTeam.shortName),
              away: factory.formFor(match.awayTeam.id, match.awayTeam.shortName),
            },
            factory.h2hFor(match),
          ),
        };
      }

      const kickoffPassed = new Date(match.kickoff).getTime() <= now.getTime();
      if (!kickoffPassed && !isFinished(match)) {
        const prediction = factory.predict(match);
        toPersist.push(toPredictionCreate(match.id, prediction));
        return { match, competition, persisted: false, prediction };
      }

      // Never invent a pick for a match that has already kicked off: that
      // would poison the accuracy record with hindsight.
      return { match, competition, persisted: false, prediction: null };
    });

    if (toPersist.length > 0) {
      try {
        await prisma.prediction.createMany({ data: toPersist, skipDuplicates: true });
      } catch (error) {
        console.warn("[repository] could not persist predictions", error);
      }
    }

    const filtered = applyFilters(fixtures, filters);
    const lastSyncAge = lastSuccessAt ? now.getTime() - new Date(lastSuccessAt).getTime() : null;

    return {
      date: filters.date,
      fixtures: filtered,
      totalOnDate: onDate.length,
      competitions,
      stats: statsFor(filtered),
      generatedAt: now.toISOString(),
      source: "live",
      freshness: {
        lastSyncAt: lastSuccessAt,
        stale: lastSyncAge === null || lastSyncAge > SYNC.staleAfterMinutes * 60_000,
        mode: "live",
      },
    };
  }

  async getMatchDetail(id: number): Promise<MatchDetail | null> {
    const matchRow = await prisma.match.findUnique({
      where: { id },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!matchRow) return null;

    const now = new Date();
    const cutoff = new Date(Math.min(now.getTime(), new Date(matchRow.kickoff).getTime()));
    const teamIds = [matchRow.homeTeamId, matchRow.awayTeamId];

    const [contextRows, stored, competitions] = await Promise.all([
      prisma.match.findMany({
        where: {
          kickoff: { gte: new Date(cutoff.getTime() - HISTORY_MS), lte: cutoff },
          OR: [
            { competitionCode: matchRow.competitionCode },
            { homeTeamId: { in: teamIds } },
            { awayTeamId: { in: teamIds } },
          ],
        },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { kickoff: "asc" },
      }),
      prisma.prediction.findUnique({ where: { matchId: id } }),
      this.getCompetitions(),
    ]);

    const matches = contextRows.map(toMatchRecord);
    const match = toMatchRecord(matchRow);
    const competitionMap = new Map(competitions.map((item) => [item.code, item]));
    const factory = new PredictionFactory(matches, { asOf: cutoff, competitions: competitionMap });
    const competition =
      competitionMap.get(match.competitionCode) ?? COMPETITION_BY_CODE[match.competitionCode];
    const h2h = factory.h2hFor(match);

    let prediction: Prediction | null = null;

    if (stored) {
      // A row written by an older model build can miss the frozen inputs the
      // page renders. Degrade to a live preview (or no pick) instead of
      // failing the whole route.
      const inputs = stored.inputs as unknown as Partial<StoredPredictionInputs> | null;
      const complete =
        typeof inputs === "object" &&
        inputs !== null &&
        Boolean(inputs.explanation) &&
        Array.isArray(inputs.scorelines) &&
        Boolean(inputs.baseline) &&
        Boolean(inputs.ratings);

      if (complete) {
        prediction = hydratePrediction(
          stored,
          {
            home: factory.formFor(match.homeTeam.id, match.homeTeam.shortName),
            away: factory.formFor(match.awayTeam.id, match.awayTeam.shortName),
          },
          h2h,
        );
      } else {
        console.warn("[repository] stored prediction is missing frozen inputs", { matchId: id });
      }
    }

    // Upcoming fixture without a stored row: show a live preview. Persistence
    // belongs to the sync job, never to a page render.
    if (!prediction && !isFinished(match) && new Date(match.kickoff).getTime() > now.getTime()) {
      prediction = factory.predict(match);
    }

    return {
      match,
      prediction,
      competition,
      h2h,
      resolved: {
        actualBtts: stored?.actualBtts ?? match.btts,
        correct: stored?.correct ?? null,
      },
      persisted: Boolean(stored),
    };
  }

  async getPerformance(): Promise<PerformanceReport> {
    const rows = await prisma.prediction.findMany({
      where: { resolvedAt: { not: null }, actualBtts: { not: null } },
      include: { match: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { resolvedAt: "desc" },
      take: 3000,
    });

    const usable = rows.filter(
      (row): row is typeof row & { actualBtts: boolean } => row.actualBtts !== null,
    );

    let hits = 0;
    let brierSum = 0;
    let logLossSum = 0;
    let probabilitySum = 0;
    let bttsSum = 0;

    const leagueMap = new Map<CompetitionCode, LeagueAccuracy>();
    const convictionMap = new Map<
      PerformanceReport["byConviction"][number]["conviction"],
      { resolved: number; hits: number }
    >();

    for (const row of usable) {
      const scored = scorePrediction(row.probabilityYes, row.actualBtts);
      if (scored.correct) hits += 1;
      brierSum += scored.brier;
      logLossSum += scored.logLoss;
      probabilitySum += row.probabilityYes;
      bttsSum += row.actualBtts ? 1 : 0;

      const code = row.match.competitionCode as CompetitionCode;
      const league = leagueMap.get(code) ?? {
        competitionCode: code,
        name: COMPETITION_BY_CODE[code]?.shortName ?? code,
        resolved: 0,
        hits: 0,
        accuracy: 0,
        brier: 0,
      };
      league.resolved += 1;
      if (scored.correct) league.hits += 1;
      league.brier += scored.brier;
      leagueMap.set(code, league);

      const conviction = convictionMap.get(row.conviction) ?? { resolved: 0, hits: 0 };
      conviction.resolved += 1;
      if (scored.correct) conviction.hits += 1;
      convictionMap.set(row.conviction, conviction);
    }

    const byLeague = Array.from(leagueMap.values())
      .map((league) => ({
        ...league,
        accuracy: league.resolved > 0 ? league.hits / league.resolved : 0,
        brier: league.resolved > 0 ? league.brier / league.resolved : 0,
      }))
      .sort((a, b) => b.resolved - a.resolved);

    const byConviction = (["HIGH", "MEDIUM", "LOW"] as const)
      .map((conviction) => {
        const entry = convictionMap.get(conviction) ?? { resolved: 0, hits: 0 };
        return {
          conviction,
          resolved: entry.resolved,
          hits: entry.hits,
          accuracy: entry.resolved > 0 ? entry.hits / entry.resolved : 0,
        };
      })
      .filter((entry) => entry.resolved > 0);

    const calibration = buildCalibration(
      usable.map((row) => ({ probabilityYes: row.probabilityYes, actualBtts: row.actualBtts })),
    );

    const recent: ResolvedPrediction[] = usable.slice(0, 24).map((row) => {
      const match = toMatchRecord(row.match);
      return {
        matchId: row.matchId,
        competitionCode: match.competitionCode,
        competitionName:
          COMPETITION_BY_CODE[match.competitionCode]?.shortName ?? match.competitionCode,
        kickoff: match.kickoff,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        score: match.score,
        pick: row.pick,
        conviction: row.conviction,
        probabilityYes: row.probabilityYes,
        actualBtts: row.actualBtts,
        correct: (row.probabilityYes >= 0.5) === row.actualBtts,
      };
    });

    const total = usable.length;
    const oldest = usable[usable.length - 1];

    return {
      modelVersion: usable[0]?.modelVersion ?? MODEL.version,
      since: oldest?.resolvedAt?.toISOString() ?? null,
      totalResolved: total,
      hits,
      accuracy: total > 0 ? hits / total : 0,
      brier: total > 0 ? brierSum / total : 0,
      logLoss: total > 0 ? logLossSum / total : 0,
      avgProbabilityYes: total > 0 ? probabilitySum / total : 0,
      actualBttsRate: total > 0 ? bttsSum / total : 0,
      calibration,
      calibrationError: calibrationError(calibration),
      byLeague,
      byConviction,
      recent,
      hasSignal: total >= 10,
    };
  }

  async getLeagueOverview(): Promise<LeagueOverview[]> {
    const now = new Date();
    const [matches, competitions] = await Promise.all([
      this.loadWindow(now),
      this.getCompetitions(),
    ]);
    return buildLeagueOverviews(matches, competitions, now, LOOKAHEAD_MS);
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const [lastRun, lastSuccessAt, budget] = await Promise.all([
      this.lastSyncRun(),
      this.lastSuccessAt(),
      getBudgetState(),
    ]);

    const ageMs = lastSuccessAt ? Date.now() - new Date(lastSuccessAt).getTime() : null;

    return {
      lastRun,
      lastSuccessAt,
      stale: ageMs === null || ageMs > SYNC.staleAfterMinutes * 60_000,
      staleAfterMinutes: SYNC.staleAfterMinutes,
      requestsLastMinute: budget.used,
      requestsPerMinuteBudget: budget.budget,
      apiConfigured: flags.api,
      databaseConfigured: flags.database,
      mode: "live",
      nextRunHint: `Vercel cron 05:00 UTC Â· lazy sync every ${SYNC.minIntervalMinutes} min`,
    };
  }
}

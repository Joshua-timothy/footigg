import { COMPETITION_BY_CODE, COMPETITIONS } from "@/lib/constants";
import type { CompetitionCode, CompetitionMeta, MatchRecord, MatchStatus, TeamRef } from "@/types/domain";
import type { FdCompetition, FdMatch, FdTeam } from "@/lib/football-data/types";

const KNOWN_STATUSES: MatchStatus[] = [
  "SCHEDULED",
  "TIMED",
  "IN_PLAY",
  "PAUSED",
  "FINISHED",
  "SUSPENDED",
  "POSTPONED",
  "CANCELLED",
  "AWARDED",
];

export function isTrackedCompetition(code: string | null | undefined): code is CompetitionCode {
  return typeof code === "string" && code in COMPETITION_BY_CODE;
}

export function mapTeam(raw: FdTeam | null | undefined): TeamRef | null {
  if (!raw || typeof raw.id !== "number") return null;
  return {
    id: raw.id,
    name: raw.name,
    shortName: raw.shortName?.trim() || raw.name,
    tla: raw.tla?.trim() || raw.name.slice(0, 3).toUpperCase(),
    crest: raw.crest ?? null,
  };
}

function mapStatus(status: string): MatchStatus {
  return (KNOWN_STATUSES as string[]).includes(status) ? (status as MatchStatus) : "SCHEDULED";
}

export function seasonStartYear(startDate: string | undefined, fallback = new Date().getUTCFullYear()): number {
  if (!startDate) return fallback;
  const year = Number(startDate.slice(0, 4));
  return Number.isFinite(year) ? year : fallback;
}

/**
 * Maps an API match to the domain model. Returns null for fixtures without
 * both teams (e.g. undecided Champions League knockout slots).
 */
export function mapMatch(raw: FdMatch): MatchRecord | null {
  if (!isTrackedCompetition(raw.competition?.code)) return null;

  const homeTeam = mapTeam(raw.homeTeam);
  const awayTeam = mapTeam(raw.awayTeam);
  if (!homeTeam || !awayTeam) return null;

  const status = mapStatus(raw.status);
  const home = raw.score?.fullTime?.home ?? null;
  const away = raw.score?.fullTime?.away ?? null;
  const finished = status === "FINISHED" && home !== null && away !== null;

  return {
    id: raw.id,
    competitionCode: raw.competition.code,
    season: seasonStartYear(raw.season?.startDate),
    matchday: raw.matchday ?? null,
    stage: raw.stage ?? null,
    kickoff: raw.utcDate,
    status,
    homeTeam,
    awayTeam,
    score: {
      home,
      away,
      htHome: raw.score?.halfTime?.home ?? null,
      htAway: raw.score?.halfTime?.away ?? null,
    },
    winner: raw.score?.winner ?? null,
    btts: finished ? (home as number) > 0 && (away as number) > 0 : null,
  };
}

/** Merges live competition metadata with our static, UI-friendly defaults. */
export function mapCompetition(raw: FdCompetition): CompetitionMeta | null {
  if (!isTrackedCompetition(raw.code)) return null;
  const base = COMPETITION_BY_CODE[raw.code];
  return {
    ...base,
    apiId: raw.id ?? base.apiId,
    name: raw.name || base.name,
    shortName: base.shortName,
    emblem: raw.emblem ?? base.emblem,
  };
}

export function fallbackCompetitions(): CompetitionMeta[] {
  return COMPETITIONS.map((competition) => ({ ...competition }));
}

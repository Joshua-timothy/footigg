import type { CompetitionCode, CompetitionMeta } from "@/types/domain";

/**
 * The ten competitions available on the football-data.org free plan.
 * `apiId` values come from https://api.football-data.org/v4/competitions.
 */
export const COMPETITIONS: CompetitionMeta[] = [
  {
    code: "PL",
    apiId: 2021,
    name: "Premier League",
    shortName: "Premier League",
    country: "England",
    emblem: null,
    season: null,
    accent: "#8b5cf6",
  },
  {
    code: "PD",
    apiId: 2014,
    name: "Primera División",
    shortName: "La Liga",
    country: "Spain",
    emblem: null,
    season: null,
    accent: "#f97316",
  },
  {
    code: "SA",
    apiId: 2019,
    name: "Serie A",
    shortName: "Serie A",
    country: "Italy",
    emblem: null,
    season: null,
    accent: "#38bdf8",
  },
  {
    code: "BL1",
    apiId: 2002,
    name: "Bundesliga",
    shortName: "Bundesliga",
    country: "Germany",
    emblem: null,
    season: null,
    accent: "#ef4444",
  },
  {
    code: "FL1",
    apiId: 2015,
    name: "Ligue 1",
    shortName: "Ligue 1",
    country: "France",
    emblem: null,
    season: null,
    accent: "#22d3ee",
  },
  {
    code: "ELC",
    apiId: 2016,
    name: "Championship",
    shortName: "Championship",
    country: "England",
    emblem: null,
    season: null,
    accent: "#eab308",
  },
  {
    code: "DED",
    apiId: 2003,
    name: "Eredivisie",
    shortName: "Eredivisie",
    country: "Netherlands",
    emblem: null,
    season: null,
    accent: "#fb7185",
  },
  {
    code: "PPL",
    apiId: 2017,
    name: "Primeira Liga",
    shortName: "Primeira Liga",
    country: "Portugal",
    emblem: null,
    season: null,
    accent: "#34d399",
  },
  {
    code: "BSA",
    apiId: 2013,
    name: "Campeonato Brasileiro Série A",
    shortName: "Brasileirão",
    country: "Brazil",
    emblem: null,
    season: null,
    accent: "#4ade80",
  },
  {
    code: "CL",
    apiId: 2001,
    name: "UEFA Champions League",
    shortName: "Champions League",
    country: "Europe",
    emblem: null,
    season: null,
    accent: "#60a5fa",
  },
];

export const COMPETITION_BY_CODE: Record<CompetitionCode, CompetitionMeta> = Object.fromEntries(
  COMPETITIONS.map((c) => [c.code, c]),
) as Record<CompetitionCode, CompetitionMeta>;

export const TRACKED_COMPETITION_CODES: CompetitionCode[] = COMPETITIONS.map((c) => c.code);

export const APP = {
  name: "FOOTIGG",
  tagline: "Both teams to score, explained.",
  description:
    "A private GG (both teams to score) board for the free football-data.org leagues. Every pick shows its working.",
  /** Cookie + storage keys. */
  sessionCookie: "footigg_session",
  timezone: process.env.NEXT_PUBLIC_TIMEZONE?.trim() || "Europe/London",
} as const;

/**
 * Model configuration. Every number here is documented in
 * docs/PREDICTION_MODEL.md and surfaced in the UI model card.
 */
export const MODEL = {
  version: "poisson-dc-1.0.0",
  /** Recency half-life for match weights, in days. */
  halfLifeDays: 200,
  /** Pseudo-matches pulling a team's rating toward the league average. */
  shrinkageMatches: 3.5,
  /** Iterative proportional fitting iterations. */
  fitIterations: 40,
  /** Damping factor for the fitting loop. */
  fitDamping: 0.5,
  /** Dixon-Coles low-score dependence parameter. */
  rho: -0.06,
  /** Goal grid size (0..maxGoals for each side). */
  maxGoals: 8,
  /** Weight of the recent-form signal before sample scaling. */
  formWeight: 0.22,
  /** Weight of the head-to-head signal before sample scaling. */
  h2hWeight: 0.1,
  /** Minimum H2H matches before the signal is used at all. */
  minH2hMatches: 3,
  /** Probability clamp so the app never claims certainty. */
  minProbability: 0.05,
  maxProbability: 0.95,
  /** History window used for fitting. */
  historyDays: 420,
  /** Recent matches shown in the form panel. */
  formMatches: 10,
  /** How many H2H meetings are kept. */
  h2hMatches: 6,
  /** Conviction thresholds (distance from 50%). */
  highConvictionEdge: 0.12,
  mediumConvictionEdge: 0.06,
  /** Below this many matches a fixture is flagged as low coverage. */
  minReliableMatches: 5,
} as const;

export const SYNC = {
  /** Free plan hard limit. We keep one request in reserve. */
  requestsPerMinute: 10,
  safeRequestsPerMinute: 8,
  /** Minimum gap between lazy syncs triggered by page views. */
  minIntervalMinutes: Number(process.env.SYNC_MIN_INTERVAL_MINUTES ?? 30),
  /** A board older than this is flagged as stale in the UI. */
  staleAfterMinutes: Number(process.env.SYNC_STALE_AFTER_MINUTES ?? 90),
  /** Board cache TTL for Next.js rendering. */
  revalidateSeconds: Number(process.env.BOARD_REVALIDATE_SECONDS ?? 900),
  /** How far ahead fixtures are synced. */
  lookaheadDays: 21,
  /** Days of history requested on the first sync. */
  historyDays: 420,
  /** Cache TTL for competition metadata. */
  competitionMetaTtlMinutes: 60 * 24 * 7,
} as const;

export const DEFAULT_BOARD_PRIOR = {
  avgHomeGoals: 1.5,
  avgAwayGoals: 1.2,
  bttsRate: 0.51,
  priorMatches: 28,
} as const;

export const MAX_FILTERS = {
  competitions: 10,
  queryLength: 48,
} as const;

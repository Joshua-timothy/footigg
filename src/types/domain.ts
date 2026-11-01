/**
 * Domain types shared by the data layer, the prediction engine and the UI.
 *
 * The prediction engine never imports Prisma or `fetch` — it only sees these
 * plain objects. That keeps it unit-testable and lets the app run against
 * either Supabase or the deterministic demo dataset.
 */

export const COMPETITION_CODES = [
  "PL",
  "PD",
  "SA",
  "BL1",
  "FL1",
  "ELC",
  "DED",
  "PPL",
  "BSA",
  "CL",
] as const;

export type CompetitionCode = (typeof COMPETITION_CODES)[number];

export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export type PickSide = "YES" | "NO";
export type Conviction = "HIGH" | "MEDIUM" | "LOW";
export type Coverage = "HIGH" | "MEDIUM" | "LOW";
export type DataSource = "live" | "demo";

export interface CompetitionMeta {
  code: CompetitionCode;
  /** football-data.org numeric competition id. */
  apiId: number;
  name: string;
  shortName: string;
  country: string;
  emblem: string | null;
  /** Start year of the season currently tracked. */
  season: number | null;
  /** Tailwind-independent accent hue used by the UI. */
  accent: string;
}

export interface TeamRef {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
}

export interface MatchScore {
  home: number | null;
  away: number | null;
  htHome: number | null;
  htAway: number | null;
}

export interface MatchRecord {
  id: number;
  competitionCode: CompetitionCode;
  season: number;
  matchday: number | null;
  stage: string | null;
  kickoff: string; // ISO 8601
  status: MatchStatus;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: MatchScore;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  /** Derived: both teams scored. Null unless the match is finished. */
  btts: boolean | null;
}

export interface FormMatch {
  matchId: number;
  kickoff: string;
  competitionCode: CompetitionCode;
  opponent: string;
  venue: "H" | "A";
  goalsFor: number;
  goalsAgainst: number;
  btts: boolean;
  result: "W" | "D" | "L";
}

export interface SplitRecord {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  bttsRate: number;
}

export interface TeamForm {
  teamId: number;
  teamName: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  bttsMatches: number;
  bttsRate: number;
  cleanSheets: number;
  failedToScore: number;
  pointsPerGame: number;
  /** Recency-weighted sample size — used for shrinkage & confidence. */
  sampleWeight: number;
  home: SplitRecord;
  away: SplitRecord;
  recent: FormMatch[];
  streak: string[];
}

export interface HeadToHead {
  matches: number;
  bttsMatches: number;
  bttsRate: number | null;
  avgTotalGoals: number | null;
  recent: MatchRecord[];
}

export interface LeagueBaseline {
  competitionCode: CompetitionCode;
  /** Finished matches used to build the baseline. */
  matches: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  avgTotalGoals: number;
  bttsRate: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
  /** True when the prior outweighed the observed sample. */
  priorDominated: boolean;
}

export interface TeamRating {
  teamId: number;
  /** Multiplicative attack strength (1.00 = league average). */
  attack: number;
  /** Multiplicative defensive strength (lower = leaks more goals). */
  defence: number;
  /** Unshrunk estimates, kept for the explanation panel. */
  rawAttack: number;
  rawDefence: number;
  matches: number;
  sampleWeight: number;
  /** 0..1 — how much the estimate trusts the team's own data. */
  reliability: number;
}

export interface CompetitionModel {
  competitionCode: CompetitionCode;
  baseline: LeagueBaseline;
  ratings: Map<number, TeamRating>;
  fittedMatches: number;
  asOf: string;
}

export interface DataQuality {
  coverage: Coverage;
  matchesUsed: number;
  homeSample: number;
  awaySample: number;
  leagueSample: number;
  notes: string[];
}

export interface ScoreLine {
  home: number;
  away: number;
  probability: number;
}

export interface MarketProbabilities {
  bttsYes: number;
  bttsNo: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  over25: number;
  over35: number;
  homeScores: number;
  awayScores: number;
  nilNil: number;
  /** Fair decimal odds (1 / probability) — no bookmaker data is used. */
  fairOddsYes: number;
  fairOddsNo: number;
}

export type FactorKey =
  | "home_attack"
  | "away_attack"
  | "home_defence"
  | "away_defence"
  | "home_advantage"
  | "form"
  | "h2h"
  | "low_score";

export interface PredictionFactor {
  key: FactorKey;
  label: string;
  /** Signed percentage-point effect on P(GG) when this input is neutralised. */
  impactPp: number;
  direction: "up" | "down" | "neutral";
  detail: string;
  value: string;
}

export interface PredictionExplanation {
  modelProbability: number;
  formProbability: number | null;
  h2hProbability: number | null;
  weights: { model: number; form: number; h2h: number };
  leagueBttsRate: number;
  rho: number;
}

export interface Prediction {
  modelVersion: string;
  probabilityYes: number;
  probabilityNo: number;
  pick: PickSide;
  conviction: Conviction;
  /** 0..1 self-assessed confidence. */
  confidence: number;
  expectedGoals: { home: number; away: number; total: number };
  scorelines: ScoreLine[];
  markets: MarketProbabilities;
  factors: PredictionFactor[];
  explanation: PredictionExplanation;
  quality: DataQuality;
  form: { home: TeamForm; away: TeamForm };
  h2h: HeadToHead;
  baseline: LeagueBaseline;
  ratings: { home: TeamRating; away: TeamRating };
  generatedAt: string;
}

/** A fixture together with its (stored or freshly computed) prediction. */
export interface FixturePrediction {
  match: MatchRecord;
  /** Null when a finished fixture was never predicted before kick-off. */
  prediction: Prediction | null;
  competition: CompetitionMeta;
  /** True when the prediction is stored in the DB (auditable). */
  persisted: boolean;
}

export interface BoardStats {
  fixtures: number;
  yesPicks: number;
  noPicks: number;
  highConviction: number;
  avgProbabilityYes: number;
  avgExpectedGoals: number;
}

export interface BoardFilters {
  date: string; // YYYY-MM-DD in the app timezone
  competitions: CompetitionCode[];
  pick: "ALL" | PickSide;
  conviction: "ALL" | Conviction;
  query: string;
}

export interface Board {
  date: string;
  fixtures: FixturePrediction[];
  /** Fixtures on this date before filters were applied. */
  totalOnDate: number;
  competitions: CompetitionMeta[];
  stats: BoardStats;
  generatedAt: string;
  source: DataSource;
  /** Human-readable reason when the board is served from cache. */
  freshness: {
    lastSyncAt: string | null;
    stale: boolean;
    mode: DataSource;
  };
}

export interface MatchDetail {
  match: MatchRecord;
  prediction: Prediction | null;
  competition: CompetitionMeta;
  h2h: HeadToHead;
  resolved: {
    actualBtts: boolean | null;
    correct: boolean | null;
  };
  persisted: boolean;
}

export interface TeamLeagueStat {
  team: TeamRef;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  bttsRate: number;
  avgTotalGoals: number;
  form: string[];
}

export interface LeagueOverview {
  competition: CompetitionMeta;
  baseline: LeagueBaseline;
  teams: TeamLeagueStat[];
  upcoming: number;
  finished: number;
}

export interface CalibrationBucket {
  label: string;
  lower: number;
  upper: number;
  predicted: number;
  actual: number;
  count: number;
}

export interface LeagueAccuracy {
  competitionCode: CompetitionCode;
  name: string;
  resolved: number;
  hits: number;
  accuracy: number;
  brier: number;
}

export interface ResolvedPrediction {
  matchId: number;
  competitionCode: CompetitionCode;
  competitionName: string;
  kickoff: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: MatchScore;
  pick: PickSide;
  conviction: Conviction;
  probabilityYes: number;
  actualBtts: boolean;
  correct: boolean;
}

export interface PerformanceReport {
  modelVersion: string;
  since: string | null;
  totalResolved: number;
  hits: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  avgProbabilityYes: number;
  actualBttsRate: number;
  calibration: CalibrationBucket[];
  calibrationError: number;
  byLeague: LeagueAccuracy[];
  byConviction: Array<{
    conviction: Conviction;
    resolved: number;
    hits: number;
    accuracy: number;
  }>;
  recent: ResolvedPrediction[];
  /** False when there are not enough resolved picks to say anything. */
  hasSignal: boolean;
}

export interface SyncRunSummary {
  id: string;
  trigger: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  startedAt: string;
  finishedAt: string | null;
  matchesSeen: number;
  matchesSaved: number;
  predictions: number;
  resolved: number;
  requests: number;
  error: string | null;
}

export interface SyncStatus {
  lastRun: SyncRunSummary | null;
  lastSuccessAt: string | null;
  stale: boolean;
  staleAfterMinutes: number;
  requestsLastMinute: number;
  requestsPerMinuteBudget: number;
  apiConfigured: boolean;
  databaseConfigured: boolean;
  mode: DataSource;
  nextRunHint: string;
}

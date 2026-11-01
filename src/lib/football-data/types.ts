/** Subset of the football-data.org v4 payloads that we actually use. */

export interface FdArea {
  id: number;
  name: string;
  code: string | null;
  flag: string | null;
}

export interface FdCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
  currentSeason?: FdSeason | null;
}

export interface FdSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number | null;
  winner: FdTeam | null;
}

export interface FdTeam {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

export interface FdScore {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export type FdMatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export interface FdMatch {
  area?: FdArea;
  competition: FdCompetition;
  season: FdSeason;
  id: number;
  utcDate: string;
  status: FdMatchStatus;
  matchday: number | null;
  stage: string | null;
  group: string | null;
  lastUpdated: string;
  homeTeam: FdTeam | null;
  awayTeam: FdTeam | null;
  score: FdScore;
}

export interface FdMatchesResponse {
  matches: FdMatch[];
  resultSet?: {
    count: number;
    competitions: string;
    first: string;
    last: string;
    played: number;
  };
}

export interface FdCompetitionsResponse {
  count: number;
  competitions: FdCompetition[];
}

export interface FdStandingsResponse {
  standings: Array<{
    stage: string;
    type: "TOTAL" | "HOME" | "AWAY";
    group: string | null;
    table: Array<{
      position: number;
      team: FdTeam;
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
      form: string | null;
    }>;
  }>;
}

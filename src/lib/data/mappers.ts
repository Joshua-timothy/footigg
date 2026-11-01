import type { Match, Prediction as PredictionRow, Team } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type {
  DataQuality,
  HeadToHead,
  LeagueBaseline,
  MarketProbabilities,
  MatchRecord,
  Prediction,
  PredictionExplanation,
  PredictionFactor,
  ScoreLine,
  TeamForm,
  TeamRating,
} from "@/types/domain";

export type MatchWithTeams = Match & { homeTeam: Team; awayTeam: Team };

export function toMatchRecord(row: MatchWithTeams): MatchRecord {
  return {
    id: row.id,
    competitionCode: row.competitionCode as MatchRecord["competitionCode"],
    season: row.season,
    matchday: row.matchday,
    stage: row.stage,
    kickoff: row.kickoff.toISOString(),
    status: row.status,
    homeTeam: {
      id: row.homeTeam.id,
      name: row.homeTeam.name,
      shortName: row.homeTeam.shortName,
      tla: row.homeTeam.tla ?? row.homeTeam.shortName.slice(0, 3).toUpperCase(),
      crest: row.homeTeam.crest,
    },
    awayTeam: {
      id: row.awayTeam.id,
      name: row.awayTeam.name,
      shortName: row.awayTeam.shortName,
      tla: row.awayTeam.tla ?? row.awayTeam.shortName.slice(0, 3).toUpperCase(),
      crest: row.awayTeam.crest,
    },
    score: {
      home: row.homeGoals,
      away: row.awayGoals,
      htHome: row.htHomeGoals,
      htAway: row.htAwayGoals,
    },
    winner: row.winner,
    btts: row.btts,
  };
}

export interface StoredPredictionInputs {
  explanation: PredictionExplanation;
  scorelines: ScoreLine[];
  baseline: LeagueBaseline;
  ratings: { home: TeamRating; away: TeamRating };
}

/** Rebuilds a Prediction from its frozen DB row plus pre-match context. */
export function hydratePrediction(
  row: PredictionRow,
  form: { home: TeamForm; away: TeamForm },
  h2h: HeadToHead,
): Prediction {
  const inputs = row.inputs as unknown as StoredPredictionInputs;
  return {
    modelVersion: row.modelVersion,
    probabilityYes: row.probabilityYes,
    probabilityNo: row.probabilityNo,
    pick: row.pick,
    conviction: row.conviction,
    confidence: row.confidence,
    expectedGoals: {
      home: row.lambdaHome,
      away: row.lambdaAway,
      total: row.expectedTotal,
    },
    scorelines: inputs.scorelines ?? [],
    markets: row.markets as unknown as MarketProbabilities,
    factors: row.factors as unknown as PredictionFactor[],
    explanation: inputs.explanation,
    quality: row.dataQuality as unknown as DataQuality,
    form,
    h2h,
    baseline: inputs.baseline,
    ratings: inputs.ratings,
    generatedAt: row.createdAt.toISOString(),
  };
}

/** Flattens a Prediction into the columns + JSON blobs we persist. */
export function toPredictionCreate(matchId: number, prediction: Prediction) {
  const inputs: StoredPredictionInputs = {
    explanation: prediction.explanation,
    scorelines: prediction.scorelines,
    baseline: prediction.baseline,
    ratings: prediction.ratings,
  };

  return {
    matchId,
    modelVersion: prediction.modelVersion,
    probabilityYes: prediction.probabilityYes,
    probabilityNo: prediction.probabilityNo,
    pick: prediction.pick,
    conviction: prediction.conviction,
    confidence: prediction.confidence,
    lambdaHome: prediction.expectedGoals.home,
    lambdaAway: prediction.expectedGoals.away,
    expectedTotal: prediction.expectedGoals.total,
    factors: prediction.factors as unknown as Prisma.InputJsonValue,
    markets: prediction.markets as unknown as Prisma.InputJsonValue,
    dataQuality: prediction.quality as unknown as Prisma.InputJsonValue,
    inputs: inputs as unknown as Prisma.InputJsonValue,
  };
}

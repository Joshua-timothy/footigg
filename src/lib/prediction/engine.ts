import { MODEL } from "@/lib/constants";
import { clamp, logit, pct, round, sigmoid } from "@/lib/utils";
import {
  bttsProbability,
  buildScoreMatrix,
  deriveVerdict,
  marketsFromMatrix,
  topScorelines,
} from "@/lib/prediction/math";
import { weightedBttsRate } from "@/lib/prediction/features";
import type {
  CompetitionMeta,
  Coverage,
  DataQuality,
  HeadToHead,
  LeagueBaseline,
  MatchRecord,
  Prediction,
  PredictionFactor,
  TeamForm,
  TeamRating,
} from "@/types/domain";

export interface PredictInput {
  match: MatchRecord;
  competition: CompetitionMeta;
  baseline: LeagueBaseline;
  homeRating: TeamRating;
  awayRating: TeamRating;
  homeForm: TeamForm;
  awayForm: TeamForm;
  h2h: HeadToHead;
  generatedAt?: string;
}

interface Variant {
  homeAttack: number;
  awayAttack: number;
  homeDefence: number;
  awayDefence: number;
  neutralVenue: boolean;
  formWeight: number;
  h2hWeight: number;
  rho: number;
}

interface Combined {
  probability: number;
  lambdaHome: number;
  lambdaAway: number;
  modelProbability: number;
}

const MIN_LAMBDA = 0.15;
const MAX_LAMBDA = 4.5;

function coverageFrom(minSample: number, leagueSample: number): Coverage {
  if (minSample >= 8 && leagueSample >= 80) return "HIGH";
  if (minSample >= MODEL.minReliableMatches) return "MEDIUM";
  return "LOW";
}

/**
 * The prediction engine.
 *
 * 1. Attack/defence ratings produce expected goals for both sides.
 * 2. A Dixon-Coles score matrix turns those into a full scoreline distribution.
 * 3. The model probability is blended in logit space with recent BTTS form and
 *    head-to-head history, each weighted by its sample size.
 * 4. Every input is ablated one at a time to produce the "why" panel.
 *
 * No randomness, no external services — the same inputs always give the same
 * output, which is what makes stored predictions auditable.
 */
export function predictMatch(input: PredictInput): Prediction {
  const { match, baseline, homeRating, awayRating, homeForm, awayForm, h2h } = input;
  const asOf = new Date(match.kickoff);

  const homeFormRate = weightedBttsRate(homeForm, asOf);
  const awayFormRate = weightedBttsRate(awayForm, asOf);
  const formSample = Math.min(homeForm.matches, awayForm.matches);

  const formProbability =
    formSample > 0
      ? ((homeFormRate + awayFormRate) / 2) * (formSample / (formSample + 3)) +
        baseline.bttsRate * (3 / (formSample + 3))
      : baseline.bttsRate;

  const hasH2h = h2h.matches >= MODEL.minH2hMatches && h2h.bttsRate !== null;
  const h2hProbability = hasH2h
    ? ((h2h.bttsMatches + 3 * baseline.bttsRate) / (h2h.matches + 3))
    : null;

  const formWeight = MODEL.formWeight * clamp(formSample / 6, 0, 1);
  const h2hWeight = hasH2h ? MODEL.h2hWeight * clamp(h2h.matches / 6, 0, 1) : 0;

  const baseVariant: Variant = {
    homeAttack: homeRating.attack,
    awayAttack: awayRating.attack,
    homeDefence: homeRating.defence,
    awayDefence: awayRating.defence,
    neutralVenue: false,
    formWeight,
    h2hWeight,
    rho: MODEL.rho,
  };

  const combine = (variant: Variant): Combined => {
    const neutral = (baseline.avgHomeGoals + baseline.avgAwayGoals) / 2;
    const avgHome = variant.neutralVenue ? neutral : baseline.avgHomeGoals;
    const avgAway = variant.neutralVenue ? neutral : baseline.avgAwayGoals;

    const lambdaHome = clamp(
      avgHome * variant.homeAttack * variant.awayDefence,
      MIN_LAMBDA,
      MAX_LAMBDA,
    );
    const lambdaAway = clamp(
      avgAway * variant.awayAttack * variant.homeDefence,
      MIN_LAMBDA,
      MAX_LAMBDA,
    );

    const grid = buildScoreMatrix(lambdaHome, lambdaAway, variant.rho, MODEL.maxGoals);
    const modelProbability = bttsProbability(grid);

    const effectiveH2h = h2hProbability !== null ? variant.h2hWeight : 0;
    const modelWeight = Math.max(0, 1 - variant.formWeight - effectiveH2h);
    const totalWeight = modelWeight + variant.formWeight + effectiveH2h;

    let logOdds = modelWeight * logit(modelProbability);
    if (variant.formWeight > 0) logOdds += variant.formWeight * logit(formProbability);
    if (effectiveH2h > 0 && h2hProbability !== null) {
      logOdds += effectiveH2h * logit(h2hProbability);
    }

    const blended =
      totalWeight > 0
        ? sigmoid(logOdds / totalWeight)
        : modelProbability;

    return {
      probability: clamp(blended, MODEL.minProbability, MODEL.maxProbability),
      lambdaHome,
      lambdaAway,
      modelProbability,
    };
  };

  const full = combine(baseVariant);
  const grid = buildScoreMatrix(full.lambdaHome, full.lambdaAway, MODEL.rho, MODEL.maxGoals);
  const markets = marketsFromMatrix(grid);

  const factor = (
    key: PredictionFactor["key"],
    label: string,
    value: string,
    detail: string,
    probabilityWithout: number,
  ): PredictionFactor => {
    const impactPp = round((full.probability - probabilityWithout) * 100, 1);
    return {
      key,
      label,
      value,
      detail,
      impactPp,
      direction: impactPp > 0.5 ? "up" : impactPp < -0.5 ? "down" : "neutral",
    };
  };

  const factors: PredictionFactor[] = [
    factor(
      "home_attack",
      `${match.homeTeam.shortName} attack`,
      `${homeRating.attack.toFixed(2)}×`,
      "Goals scored per home game, recency-weighted and shrunk toward the league average.",
      combine({ ...baseVariant, homeAttack: 1 }).probability,
    ),
    factor(
      "away_defence",
      `${match.awayTeam.shortName} defence`,
      `${awayRating.defence.toFixed(2)}×`,
      "Goals conceded away from home. Values above 1.00 mean the defence leaks more than average.",
      combine({ ...baseVariant, awayDefence: 1 }).probability,
    ),
    factor(
      "away_attack",
      `${match.awayTeam.shortName} attack`,
      `${awayRating.attack.toFixed(2)}×`,
      "Goals scored per away game, recency-weighted and shrunk toward the league average.",
      combine({ ...baseVariant, awayAttack: 1 }).probability,
    ),
    factor(
      "home_defence",
      `${match.homeTeam.shortName} defence`,
      `${homeRating.defence.toFixed(2)}×`,
      "Goals conceded at home. Values above 1.00 mean the defence leaks more than average.",
      combine({ ...baseVariant, homeDefence: 1 }).probability,
    ),
    factor(
      "home_advantage",
      "Home advantage",
      `${(baseline.avgHomeGoals / Math.max(baseline.avgAwayGoals, 0.01)).toFixed(2)}×`,
      "How much the league's home sides out-score away sides. Neutralised by using the league's average goal rate for both teams.",
      combine({ ...baseVariant, neutralVenue: true }).probability,
    ),
    factor(
      "form",
      "Recent GG form",
      `${pct(formProbability)} · ${formSample} games`,
      "Recency-weighted share of both teams' recent matches where both sides scored.",
      combine({ ...baseVariant, formWeight: 0 }).probability,
    ),
  ];

  if (hasH2h) {
    factors.push(
      factor(
        "h2h",
        "Head-to-head",
        `${pct(h2h.bttsRate ?? 0)} · ${h2h.matches} games`,
        "Share of recent meetings that finished with both teams scoring.",
        combine({ ...baseVariant, h2hWeight: 0 }).probability,
      ),
    );
  }

  factors.push(
    factor(
      "low_score",
      "Low-score correction",
      `ρ ${MODEL.rho.toFixed(2)}`,
      "Dixon-Coles adjustment: real football produces more 0-0 and 1-1 results than independent Poisson expects.",
      combine({ ...baseVariant, rho: 0 }).probability,
    ),
  );

  factors.sort((a, b) => Math.abs(b.impactPp) - Math.abs(a.impactPp));

  const minSample = Math.min(homeForm.matches, awayForm.matches);
  const ratingReliability = Math.min(homeRating.reliability, awayRating.reliability);
  const reliability = clamp(
    clamp(minSample / 8, 0, 1) * 0.6 + ratingReliability * 0.4,
    0,
    1,
  );

  const verdict = deriveVerdict(full.probability, reliability);
  const quality = buildDataQuality({
    match,
    baseline,
    homeForm,
    awayForm,
    h2h,
    homeRating,
    awayRating,
  });

  return {
    modelVersion: MODEL.version,
    probabilityYes: full.probability,
    probabilityNo: 1 - full.probability,
    pick: verdict.pick,
    conviction: verdict.conviction,
    confidence: verdict.confidence,
    expectedGoals: {
      home: full.lambdaHome,
      away: full.lambdaAway,
      total: full.lambdaHome + full.lambdaAway,
    },
    scorelines: topScorelines(grid, 6),
    markets,
    factors,
    explanation: {
      modelProbability: full.modelProbability,
      formProbability: formSample > 0 ? formProbability : null,
      h2hProbability,
      weights: {
        model: round(1 - formWeight - h2hWeight, 3),
        form: round(formWeight, 3),
        h2h: round(h2hWeight, 3),
      },
      leagueBttsRate: baseline.bttsRate,
      rho: MODEL.rho,
    },
    quality,
    form: { home: homeForm, away: awayForm },
    h2h,
    baseline,
    ratings: { home: homeRating, away: awayRating },
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

function buildDataQuality(args: {
  match: MatchRecord;
  baseline: LeagueBaseline;
  homeForm: TeamForm;
  awayForm: TeamForm;
  h2h: HeadToHead;
  homeRating: TeamRating;
  awayRating: TeamRating;
}): DataQuality {
  const { match, baseline, homeForm, awayForm, h2h, homeRating, awayRating } = args;
  const minSample = Math.min(homeForm.matches, awayForm.matches);
  const coverage = coverageFrom(minSample, baseline.matches);
  const notes: string[] = [];

  if (homeForm.matches < MODEL.minReliableMatches) {
    notes.push(
      `Only ${homeForm.matches} recent ${match.homeTeam.shortName} match${homeForm.matches === 1 ? "" : "es"} available — ratings are pulled toward the league average.`,
    );
  }
  if (awayForm.matches < MODEL.minReliableMatches) {
    notes.push(
      `Only ${awayForm.matches} recent ${match.awayTeam.shortName} match${awayForm.matches === 1 ? "" : "es"} available — ratings are pulled toward the league average.`,
    );
  }
  if (baseline.priorDominated) {
    notes.push(
      `Early-season sample (${baseline.matches} finished league games): the scoring baseline leans on a long-run prior.`,
    );
  }
  if (h2h.matches < MODEL.minH2hMatches) {
    notes.push("No reliable head-to-head sample, so that signal is switched off.");
  }
  if (homeRating.matches === 0 || awayRating.matches === 0) {
    notes.push("One side has no finished matches in the data window yet.");
  }
  if (match.competitionCode === "CL") {
    notes.push(
      "Cup and continental fixtures carry more variance. Ratings come from each side's domestic league form.",
    );
  }
  if (notes.length === 0) {
    notes.push("Both teams have a healthy sample of recent matches in this competition.");
  }

  return {
    coverage,
    matchesUsed: minSample,
    homeSample: homeForm.matches,
    awaySample: awayForm.matches,
    leagueSample: baseline.matches,
    notes,
  };
}

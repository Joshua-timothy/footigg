import { MODEL } from "@/lib/constants";
import type { MarketProbabilities, ScoreLine } from "@/types/domain";
import { clamp } from "@/lib/utils";

const LOG_FACTORIAL: number[] = (() => {
  const table = [0];
  for (let i = 1; i <= 32; i += 1) table[i] = table[i - 1] + Math.log(i);
  return table;
})();

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0) return 0;
  const logP = -lambda + k * Math.log(lambda) - (LOG_FACTORIAL[k] ?? 0);
  return Math.exp(logP);
}

/**
 * Dixon-Coles low-score correction. Association football under-represents 0-0
 * and 1-1 relative to independent Poisson and over-represents 1-0 / 0-1.
 * `rho` is negative for real football data.
 */
export function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

/**
 * Joint scoreline distribution, normalised after the Dixon-Coles adjustment so
 * the grid always sums to 1.
 */
export function buildScoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = MODEL.rho,
  maxGoals: number = MODEL.maxGoals,
): number[][] {
  const grid: number[][] = [];
  let total = 0;

  for (let home = 0; home <= maxGoals; home += 1) {
    const row: number[] = [];
    for (let away = 0; away <= maxGoals; away += 1) {
      const independent = poissonPmf(home, lambdaHome) * poissonPmf(away, lambdaAway);
      const adjusted = independent * dixonColesTau(home, away, lambdaHome, lambdaAway, rho);
      const value = Number.isFinite(adjusted) && adjusted > 0 ? adjusted : 0;
      row.push(value);
      total += value;
    }
    grid.push(row);
  }

  if (total <= 0) {
    return grid.map((row) => row.map(() => 0));
  }

  return grid.map((row) => row.map((value) => value / total));
}

export function bttsProbability(grid: number[][]): number {
  let probability = 0;
  for (let home = 1; home < grid.length; home += 1) {
    for (let away = 1; away < grid[home].length; away += 1) {
      probability += grid[home][away];
    }
  }
  return probability;
}

export function marketsFromMatrix(grid: number[][]): MarketProbabilities {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let homeScores = 0;
  let awayScores = 0;
  let nilNil = 0;

  for (let home = 0; home < grid.length; home += 1) {
    for (let away = 0; away < grid[home].length; away += 1) {
      const p = grid[home][away];
      if (home > away) homeWin += p;
      else if (home === away) draw += p;
      else awayWin += p;

      const total = home + away;
      if (total >= 2) over15 += p;
      if (total >= 3) over25 += p;
      if (total >= 4) over35 += p;

      if (home >= 1) homeScores += p;
      if (away >= 1) awayScores += p;
      if (home === 0 && away === 0) nilNil += p;
    }
  }

  const bttsYes = bttsProbability(grid);

  return {
    bttsYes,
    bttsNo: 1 - bttsYes,
    homeWin,
    draw,
    awayWin,
    over15,
    over25,
    over35,
    homeScores,
    awayScores,
    nilNil,
    fairOddsYes: bttsYes > 0 ? 1 / bttsYes : 0,
    fairOddsNo: bttsYes < 1 ? 1 / (1 - bttsYes) : 0,
  };
}

export function topScorelines(grid: number[][], count = 6): ScoreLine[] {
  const lines: ScoreLine[] = [];
  for (let home = 0; home < grid.length; home += 1) {
    for (let away = 0; away < grid[home].length; away += 1) {
      lines.push({ home, away, probability: grid[home][away] });
    }
  }
  return lines.sort((a, b) => b.probability - a.probability).slice(0, count);
}

/**
 * Turns a probability into a pick, a conviction tier and a confidence score.
 * Confidence blends distance from a coin flip with how much real data backs it.
 */
export function deriveVerdict(
  probabilityYes: number,
  reliability: number,
): { pick: "YES" | "NO"; conviction: "HIGH" | "MEDIUM" | "LOW"; confidence: number } {
  const pick = probabilityYes >= 0.5 ? "YES" : "NO";
  const distance = Math.abs(probabilityYes - 0.5);

  const conviction =
    distance >= MODEL.highConvictionEdge && reliability >= 0.45
      ? "HIGH"
      : distance >= MODEL.mediumConvictionEdge
        ? "MEDIUM"
        : "LOW";

  const confidence = clamp(
    0.3 + 0.45 * Math.min(1, distance / 0.3) + 0.2 * clamp(reliability, 0, 1),
    0.05,
    0.97,
  );

  return { pick, conviction, confidence };
}

import { DEFAULT_BOARD_PRIOR, MODEL } from "@/lib/constants";
import { clamp, safeDivide } from "@/lib/utils";
import type {
  CompetitionCode,
  CompetitionModel,
  FormMatch,
  HeadToHead,
  LeagueBaseline,
  MatchRecord,
  SplitRecord,
  TeamForm,
  TeamRating,
} from "@/types/domain";

export function isFinished(match: MatchRecord): boolean {
  return (
    match.status === "FINISHED" &&
    match.score.home !== null &&
    match.score.away !== null
  );
}

export function isUpcoming(match: MatchRecord): boolean {
  return match.status === "SCHEDULED" || match.status === "TIMED" || match.status === "IN_PLAY" || match.status === "PAUSED";
}

export function isBefore(match: MatchRecord, asOf: Date): boolean {
  return new Date(match.kickoff).getTime() < asOf.getTime();
}

export function matchBtts(match: MatchRecord): boolean | null {
  if (!isFinished(match)) return null;
  return (match.score.home as number) > 0 && (match.score.away as number) > 0;
}

export function recencyWeight(kickoff: string, asOf: Date, halfLifeDays = MODEL.halfLifeDays): number {
  const ageDays = Math.max(0, (asOf.getTime() - new Date(kickoff).getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * League scoring environment. Shrunk toward a long-run prior so that the first
 * few matchdays of a season cannot produce extreme lambdas.
 */
export function computeLeagueBaseline(
  matches: MatchRecord[],
  competitionCode: CompetitionCode,
  asOf: Date,
  options: { filterCompetition?: boolean } = {},
): LeagueBaseline {
  const filterCompetition = options.filterCompetition ?? true;
  const finished = matches.filter(
    (match) =>
      (!filterCompetition || match.competitionCode === competitionCode) &&
      isFinished(match) &&
      isBefore(match, asOf),
  );

  const prior = DEFAULT_BOARD_PRIOR;
  let homeGoals = 0;
  let awayGoals = 0;
  let btts = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (const match of finished) {
    const home = match.score.home as number;
    const away = match.score.away as number;
    homeGoals += home;
    awayGoals += away;
    if (home > 0 && away > 0) btts += 1;
    if (home > away) homeWins += 1;
    else if (home === away) draws += 1;
    else awayWins += 1;
  }

  const n = finished.length;
  const k = prior.priorMatches;
  const avgHomeGoals = (homeGoals + prior.avgHomeGoals * k) / (n + k);
  const avgAwayGoals = (awayGoals + prior.avgAwayGoals * k) / (n + k);
  const bttsRate = (btts + prior.bttsRate * k) / (n + k);

  return {
    competitionCode,
    matches: n,
    avgHomeGoals,
    avgAwayGoals,
    avgTotalGoals: avgHomeGoals + avgAwayGoals,
    bttsRate,
    homeWinRate: n > 0 ? safeDivide(homeWins, n, 0.45) : 0.45,
    drawRate: n > 0 ? safeDivide(draws, n, 0.26) : 0.26,
    awayWinRate: n > 0 ? safeDivide(awayWins, n, 0.29) : 0.29,
    priorDominated: n < k,
  };
}

function toFormMatch(match: MatchRecord, teamId: number): FormMatch | null {
  if (!isFinished(match)) return null;
  const isHome = match.homeTeam.id === teamId;
  const goalsFor = (isHome ? match.score.home : match.score.away) as number;
  const goalsAgainst = (isHome ? match.score.away : match.score.home) as number;
  return {
    matchId: match.id,
    kickoff: match.kickoff,
    competitionCode: match.competitionCode,
    opponent: isHome ? match.awayTeam.shortName : match.homeTeam.shortName,
    venue: isHome ? "H" : "A",
    goalsFor,
    goalsAgainst,
    btts: goalsFor > 0 && goalsAgainst > 0,
    result: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
  };
}

function emptySplit(): SplitRecord {
  return { matches: 0, goalsFor: 0, goalsAgainst: 0, bttsRate: 0 };
}

export function buildTeamForm(
  teamId: number,
  teamName: string,
  matches: MatchRecord[],
  asOf: Date,
  limit = MODEL.formMatches,
): TeamForm {
  const recent: FormMatch[] = [];
  for (const match of matches) {
    if (!isFinished(match) || !isBefore(match, asOf)) continue;
    if (match.homeTeam.id !== teamId && match.awayTeam.id !== teamId) continue;
    const entry = toFormMatch(match, teamId);
    if (entry) recent.push(entry);
  }

  recent.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
  const window = recent.slice(0, limit);

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let bttsMatches = 0;
  let cleanSheets = 0;
  let failedToScore = 0;
  let points = 0;
  let sampleWeight = 0;

  const home = emptySplit();
  const away = emptySplit();

  for (const entry of window) {
    goalsFor += entry.goalsFor;
    goalsAgainst += entry.goalsAgainst;
    if (entry.btts) bttsMatches += 1;
    if (entry.goalsAgainst === 0) cleanSheets += 1;
    if (entry.goalsFor === 0) failedToScore += 1;
    if (entry.result === "W") {
      wins += 1;
      points += 3;
    } else if (entry.result === "D") {
      draws += 1;
      points += 1;
    } else {
      losses += 1;
    }

    sampleWeight += recencyWeight(entry.kickoff, asOf);

    const split = entry.venue === "H" ? home : away;
    split.matches += 1;
    split.goalsFor += entry.goalsFor;
    split.goalsAgainst += entry.goalsAgainst;
    if (entry.btts) split.bttsRate += 1;
  }

  home.bttsRate = safeDivide(home.bttsRate, home.matches);
  away.bttsRate = safeDivide(away.bttsRate, away.matches);

  return {
    teamId,
    teamName,
    matches: window.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    avgGoalsFor: safeDivide(goalsFor, window.length),
    avgGoalsAgainst: safeDivide(goalsAgainst, window.length),
    bttsMatches,
    bttsRate: safeDivide(bttsMatches, window.length),
    cleanSheets,
    failedToScore,
    pointsPerGame: safeDivide(points, window.length),
    sampleWeight,
    home,
    away,
    recent: window,
    streak: window.slice(0, 5).map((entry) => entry.result),
  };
}

/** Builds forms for every team in one pass over the match list. */
export function buildAllTeamForms(
  matches: MatchRecord[],
  asOf: Date,
  limit = MODEL.formMatches,
): Map<number, TeamForm> {
  const byTeam = new Map<number, { name: string; matches: MatchRecord[] }>();

  for (const match of matches) {
    if (!isFinished(match)) continue;
    for (const team of [match.homeTeam, match.awayTeam]) {
      const existing = byTeam.get(team.id);
      if (existing) existing.matches.push(match);
      else byTeam.set(team.id, { name: team.shortName, matches: [match] });
    }
  }

  const forms = new Map<number, TeamForm>();
  for (const [teamId, entry] of byTeam) {
    forms.set(teamId, buildTeamForm(teamId, entry.name, entry.matches, asOf, limit));
  }
  return forms;
}

export function computeHeadToHead(
  homeTeamId: number,
  awayTeamId: number,
  matches: MatchRecord[],
  asOf: Date,
  limit = MODEL.h2hMatches,
): HeadToHead {
  const meetings = matches.filter((match) => {
    if (!isFinished(match) || !isBefore(match, asOf)) return false;
    const ids = [match.homeTeam.id, match.awayTeam.id];
    return ids.includes(homeTeamId) && ids.includes(awayTeamId);
  });

  meetings.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
  const recent = meetings.slice(0, limit);

  let bttsMatches = 0;
  let totalGoals = 0;
  for (const match of recent) {
    const home = match.score.home as number;
    const away = match.score.away as number;
    totalGoals += home + away;
    if (home > 0 && away > 0) bttsMatches += 1;
  }

  return {
    matches: recent.length,
    bttsMatches,
    bttsRate: recent.length > 0 ? bttsMatches / recent.length : null,
    avgTotalGoals: recent.length > 0 ? totalGoals / recent.length : null,
    recent,
  };
}

interface Observation {
  home: number;
  away: number;
  homeGoals: number;
  awayGoals: number;
  weight: number;
}

interface TeamSample {
  matches: number;
  weight: number;
}

/**
 * Weighted Poisson ratings fitted with iterative proportional fitting
 * (a Maher/Dixon-Coles style attack/defence model).
 *
 *   E[home goals] = leagueAvgHome * attack[home] * defence[away]
 *   E[away goals] = leagueAvgAway * attack[away] * defence[home]
 *
 * Recent matches count more (exponential decay), and small samples are shrunk
 * toward 1.00 so a newly promoted side cannot get a 3.4x attack rating after
 * two games.
 */
export function fitRatings(
  matches: MatchRecord[],
  baseline: LeagueBaseline,
  asOf: Date,
  options: { filterCompetition?: boolean } = {},
): Map<number, TeamRating> {
  const filterCompetition = options.filterCompetition ?? true;
  const observations: Observation[] = [];
  const samples = new Map<number, TeamSample>();

  for (const match of matches) {
    if (filterCompetition && match.competitionCode !== baseline.competitionCode) continue;
    if (!isFinished(match) || !isBefore(match, asOf)) continue;

    const weight = recencyWeight(match.kickoff, asOf);
    observations.push({
      home: match.homeTeam.id,
      away: match.awayTeam.id,
      homeGoals: match.score.home as number,
      awayGoals: match.score.away as number,
      weight,
    });

    for (const teamId of [match.homeTeam.id, match.awayTeam.id]) {
      const sample = samples.get(teamId);
      if (sample) {
        sample.matches += 1;
        sample.weight += weight;
      } else {
        samples.set(teamId, { matches: 1, weight });
      }
    }
  }

  if (observations.length === 0) return new Map();

  const attack = new Map<number, number>();
  const defence = new Map<number, number>();
  for (const teamId of samples.keys()) {
    attack.set(teamId, 1);
    defence.set(teamId, 1);
  }

  const fitPrior = 1.5;
  const priorHome = baseline.avgHomeGoals;
  const priorAway = baseline.avgAwayGoals;

  for (let iteration = 0; iteration < MODEL.fitIterations; iteration += 1) {
    const numAttack = new Map<number, number>();
    const denAttack = new Map<number, number>();
    const numDefence = new Map<number, number>();
    const denDefence = new Map<number, number>();

    for (const teamId of samples.keys()) {
      numAttack.set(teamId, 0);
      denAttack.set(teamId, 0);
      numDefence.set(teamId, 0);
      denDefence.set(teamId, 0);
    }

    for (const obs of observations) {
      const expectedHome = baseline.avgHomeGoals * (attack.get(obs.home) ?? 1) * (defence.get(obs.away) ?? 1);
      const expectedAway = baseline.avgAwayGoals * (attack.get(obs.away) ?? 1) * (defence.get(obs.home) ?? 1);

      numAttack.set(obs.home, (numAttack.get(obs.home) ?? 0) + obs.weight * obs.homeGoals);
      denAttack.set(obs.home, (denAttack.get(obs.home) ?? 0) + obs.weight * expectedHome);
      numDefence.set(obs.home, (numDefence.get(obs.home) ?? 0) + obs.weight * obs.awayGoals);
      denDefence.set(obs.home, (denDefence.get(obs.home) ?? 0) + obs.weight * expectedAway);

      numAttack.set(obs.away, (numAttack.get(obs.away) ?? 0) + obs.weight * obs.awayGoals);
      denAttack.set(obs.away, (denAttack.get(obs.away) ?? 0) + obs.weight * expectedAway);
      numDefence.set(obs.away, (numDefence.get(obs.away) ?? 0) + obs.weight * obs.homeGoals);
      denDefence.set(obs.away, (denDefence.get(obs.away) ?? 0) + obs.weight * expectedHome);
    }

    for (const teamId of samples.keys()) {
      const attackRatio =
        ((numAttack.get(teamId) ?? 0) + fitPrior * priorHome) /
        ((denAttack.get(teamId) ?? 0) + fitPrior * priorHome);
      const defenceRatio =
        ((numDefence.get(teamId) ?? 0) + fitPrior * priorAway) /
        ((denDefence.get(teamId) ?? 0) + fitPrior * priorAway);

      const currentAttack = attack.get(teamId) ?? 1;
      const currentDefence = defence.get(teamId) ?? 1;

      attack.set(
        teamId,
        clamp(currentAttack * Math.pow(attackRatio, MODEL.fitDamping), 0.2, 5),
      );
      defence.set(
        teamId,
        clamp(currentDefence * Math.pow(defenceRatio, MODEL.fitDamping), 0.2, 5),
      );
    }

    // Attack/defence are only identified up to a shared scale. Anchor the
    // geometric mean of attack at 1.00 so ratings stay interpretable.
    let logSum = 0;
    for (const teamId of samples.keys()) logSum += Math.log(attack.get(teamId) ?? 1);
    const geoMean = Math.exp(logSum / samples.size);
    if (Number.isFinite(geoMean) && geoMean > 0) {
      for (const teamId of samples.keys()) {
        attack.set(teamId, (attack.get(teamId) ?? 1) / geoMean);
        defence.set(teamId, (defence.get(teamId) ?? 1) * geoMean);
      }
    }
  }

  const ratings = new Map<number, TeamRating>();
  for (const [teamId, sample] of samples) {
    const rawAttack = attack.get(teamId) ?? 1;
    const rawDefence = defence.get(teamId) ?? 1;
    const reliability = sample.weight / (sample.weight + MODEL.shrinkageMatches);
    const shrunkAttack = 1 + (rawAttack - 1) * reliability;
    const shrunkDefence = 1 + (rawDefence - 1) * reliability;

    ratings.set(teamId, {
      teamId,
      attack: clamp(shrunkAttack, 0.2, 5),
      defence: clamp(shrunkDefence, 0.2, 5),
      rawAttack,
      rawDefence,
      matches: sample.matches,
      sampleWeight: sample.weight,
      reliability,
    });
  }

  return ratings;
}

export function emptyRating(teamId: number): TeamRating {
  return {
    teamId,
    attack: 1,
    defence: 1,
    rawAttack: 1,
    rawDefence: 1,
    matches: 0,
    sampleWeight: 0,
    reliability: 0,
  };
}

export function buildCompetitionModel(
  matches: MatchRecord[],
  competitionCode: CompetitionCode,
  asOf: Date,
): CompetitionModel {
  const baseline = computeLeagueBaseline(matches, competitionCode, asOf);
  const ratings = fitRatings(matches, baseline, asOf);
  return {
    competitionCode,
    baseline,
    ratings,
    fittedMatches: baseline.matches,
    asOf: asOf.toISOString(),
  };
}

/**
 * Recency-weighted BTTS rate for a form window. Falls back to the flat rate
 * when the window is empty.
 */
export function weightedBttsRate(form: TeamForm, asOf: Date): number {
  if (form.recent.length === 0) return form.bttsRate;
  let weighted = 0;
  let weight = 0;
  for (const entry of form.recent) {
    const w = recencyWeight(entry.kickoff, asOf);
    weighted += w * (entry.btts ? 1 : 0);
    weight += w;
  }
  return weight > 0 ? weighted / weight : form.bttsRate;
}

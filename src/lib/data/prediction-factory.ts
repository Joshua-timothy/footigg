import { COMPETITION_BY_CODE, COMPETITIONS } from "@/lib/constants";
import {
  buildAllTeamForms,
  buildTeamForm,
  computeHeadToHead,
  computeLeagueBaseline,
  emptyRating,
  fitRatings,
  isFinished,
  predictMatch,
} from "@/lib/prediction";
import type {
  CompetitionCode,
  CompetitionMeta,
  HeadToHead,
  LeagueBaseline,
  MatchRecord,
  Prediction,
  TeamForm,
  TeamRating,
} from "@/types/domain";

interface ModelSlice {
  baseline: LeagueBaseline;
  ratings: Map<number, TeamRating>;
}

export interface PredictionFactoryOptions {
  /** Everything after this instant is invisible to the model. */
  asOf: Date;
  competitions?: Map<CompetitionCode, CompetitionMeta>;
}

/**
 * Fits competition models once and reuses them for every fixture in a batch.
 * This is the seam between "data" and "engine": it owns no I/O.
 */
export class PredictionFactory {
  readonly asOf: Date;
  private readonly matches: MatchRecord[];
  private readonly competitions: Map<CompetitionCode, CompetitionMeta>;
  private readonly forms: Map<number, TeamForm>;
  private readonly models = new Map<string, ModelSlice>();
  private readonly h2hCache = new Map<string, HeadToHead>();
  private readonly teamLeague = new Map<number, CompetitionCode>();

  constructor(matches: MatchRecord[], options: PredictionFactoryOptions) {
    this.matches = matches;
    this.asOf = options.asOf;
    this.competitions =
      options.competitions ?? new Map(COMPETITIONS.map((competition) => [competition.code, competition]));
    this.forms = buildAllTeamForms(matches, this.asOf);

    const counts = new Map<number, Map<CompetitionCode, number>>();
    for (const match of matches) {
      if (!isFinished(match)) continue;
      for (const team of [match.homeTeam, match.awayTeam]) {
        const perTeam = counts.get(team.id) ?? new Map<CompetitionCode, number>();
        perTeam.set(match.competitionCode, (perTeam.get(match.competitionCode) ?? 0) + 1);
        counts.set(team.id, perTeam);
      }
    }
    for (const [teamId, perTeam] of counts) {
      let best: CompetitionCode | null = null;
      let bestCount = -1;
      for (const [code, count] of perTeam) {
        if (count > bestCount) {
          best = code;
          bestCount = count;
        }
      }
      if (best) this.teamLeague.set(teamId, best);
    }
  }

  competitionFor(match: MatchRecord): CompetitionMeta {
    return (
      this.competitions.get(match.competitionCode) ?? COMPETITION_BY_CODE[match.competitionCode]
    );
  }

  formFor(teamId: number, teamName: string): TeamForm {
    return this.forms.get(teamId) ?? buildTeamForm(teamId, teamName, [], this.asOf);
  }

  h2hFor(match: MatchRecord): HeadToHead {
    const key = `${Math.min(match.homeTeam.id, match.awayTeam.id)}:${Math.max(
      match.homeTeam.id,
      match.awayTeam.id,
    )}`;
    const cached = this.h2hCache.get(key);
    if (cached) return cached;
    const h2h = computeHeadToHead(
      match.homeTeam.id,
      match.awayTeam.id,
      this.matches,
      this.asOf,
    );
    this.h2hCache.set(key, h2h);
    return h2h;
  }

  private getModel(match: MatchRecord): ModelSlice {
    const isCup = match.competitionCode === "CL";
    const homeLeague = this.teamLeague.get(match.homeTeam.id) ?? "PL";
    const awayLeague = this.teamLeague.get(match.awayTeam.id) ?? homeLeague;
    const key = isCup ? `CL:${homeLeague}:${awayLeague}` : match.competitionCode;

    const cached = this.models.get(key);
    if (cached) return cached;

    let slice: ModelSlice;

    if (isCup) {
      // Champions League sides come from different domestic leagues, so we fit
      // one joint model over both leagues plus the CL matches themselves.
      const leagues = new Set<CompetitionCode>([homeLeague, awayLeague, "CL"]);
      const pool = this.matches.filter((candidate) => leagues.has(candidate.competitionCode));
      const baseline = computeLeagueBaseline(pool, "CL", this.asOf, { filterCompetition: false });
      slice = {
        baseline,
        ratings: fitRatings(pool, baseline, this.asOf, { filterCompetition: false }),
      };
    } else {
      const baseline = computeLeagueBaseline(this.matches, match.competitionCode, this.asOf);
      slice = {
        baseline,
        ratings: fitRatings(this.matches, baseline, this.asOf),
      };
    }

    this.models.set(key, slice);
    return slice;
  }

  predict(match: MatchRecord): Prediction {
    const model = this.getModel(match);
    const homeRating = model.ratings.get(match.homeTeam.id) ?? emptyRating(match.homeTeam.id);
    const awayRating = model.ratings.get(match.awayTeam.id) ?? emptyRating(match.awayTeam.id);

    return predictMatch({
      match,
      competition: this.competitionFor(match),
      baseline: model.baseline,
      homeRating,
      awayRating,
      homeForm: this.formFor(match.homeTeam.id, match.homeTeam.shortName),
      awayForm: this.formFor(match.awayTeam.id, match.awayTeam.shortName),
      h2h: this.h2hFor(match),
      generatedAt: new Date().toISOString(),
    });
  }

  predictMany(matches: MatchRecord[]): Map<number, Prediction> {
    const result = new Map<number, Prediction>();
    for (const match of matches) result.set(match.id, this.predict(match));
    return result;
  }
}

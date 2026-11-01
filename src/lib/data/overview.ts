import { computeLeagueBaseline, isFinished } from "@/lib/prediction";
import type {
  CompetitionMeta,
  LeagueOverview,
  MatchRecord,
  TeamLeagueStat,
  TeamRef,
} from "@/types/domain";

interface TeamAccumulator {
  team: TeamRef;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  btts: number;
  points: number;
  recent: string[];
}

/**
 * League tables + BTTS base rates, computed from the stored match history.
 * Shared by the live and demo repositories so both show identical logic.
 */
export function buildLeagueOverviews(
  matches: MatchRecord[],
  competitions: CompetitionMeta[],
  now: Date,
  lookaheadMs: number,
): LeagueOverview[] {
  return competitions.map((competition) => {
    const compMatches = matches.filter((match) => match.competitionCode === competition.code);
    const baseline = computeLeagueBaseline(compMatches, competition.code, now);
    const finished = compMatches.filter(isFinished);
    const season =
      competition.season ?? finished.reduce((latest, match) => Math.max(latest, match.season), 0);
    const seasonMatches = finished.filter((match) => match.season === season);
    const ordered = [...seasonMatches].sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
    );

    const teamMap = new Map<number, TeamAccumulator>();
    const ensure = (team: TeamRef): TeamAccumulator => {
      const existing = teamMap.get(team.id);
      if (existing) return existing;
      const created: TeamAccumulator = {
        team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        btts: 0,
        points: 0,
        recent: [],
      };
      teamMap.set(team.id, created);
      return created;
    };

    for (const match of ordered) {
      const home = ensure(match.homeTeam);
      const away = ensure(match.awayTeam);
      const homeGoals = match.score.home as number;
      const awayGoals = match.score.away as number;
      const bothScored = homeGoals > 0 && awayGoals > 0;

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;
      if (bothScored) {
        home.btts += 1;
        away.btts += 1;
      }

      if (homeGoals > awayGoals) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
        if (home.recent.length < 5) home.recent.push("W");
        if (away.recent.length < 5) away.recent.push("L");
      } else if (homeGoals === awayGoals) {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
        if (home.recent.length < 5) home.recent.push("D");
        if (away.recent.length < 5) away.recent.push("D");
      } else {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
        if (away.recent.length < 5) away.recent.push("W");
        if (home.recent.length < 5) home.recent.push("L");
      }
    }

    const teams: TeamLeagueStat[] = Array.from(teamMap.values())
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
          b.goalsFor - a.goalsFor,
      )
      .map((entry) => ({
        team: entry.team,
        played: entry.played,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        goalsFor: entry.goalsFor,
        goalsAgainst: entry.goalsAgainst,
        bttsRate: entry.played > 0 ? entry.btts / entry.played : 0,
        avgTotalGoals:
          entry.played > 0 ? (entry.goalsFor + entry.goalsAgainst) / entry.played : 0,
        form: entry.recent,
      }));

    return {
      competition: { ...competition, season: season || competition.season },
      baseline,
      teams,
      upcoming: compMatches.filter(
        (match) =>
          !isFinished(match) &&
          new Date(match.kickoff).getTime() > now.getTime() &&
          new Date(match.kickoff).getTime() < now.getTime() + lookaheadMs,
      ).length,
      finished: seasonMatches.length,
    };
  });
}

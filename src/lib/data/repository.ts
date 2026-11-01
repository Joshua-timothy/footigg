import type {
  Board,
  BoardFilters,
  CompetitionMeta,
  DataSource,
  LeagueOverview,
  MatchDetail,
  PerformanceReport,
  SyncStatus,
} from "@/types/domain";

/**
 * The single contract the UI depends on. Two implementations exist:
 *  • PrismaRepository — Supabase Postgres + football-data.org
 *  • DemoRepository   — deterministic synthetic season, zero configuration
 */
export interface FootballRepository {
  readonly source: DataSource;
  getCompetitions(): Promise<CompetitionMeta[]>;
  getBoard(filters: BoardFilters): Promise<Board>;
  getMatchDetail(id: number): Promise<MatchDetail | null>;
  getPerformance(): Promise<PerformanceReport>;
  getLeagueOverview(): Promise<LeagueOverview[]>;
  getSyncStatus(): Promise<SyncStatus>;
}

export function emptyStats(): Board["stats"] {
  return {
    fixtures: 0,
    yesPicks: 0,
    noPicks: 0,
    highConviction: 0,
    avgProbabilityYes: 0,
    avgExpectedGoals: 0,
  };
}

export function statsFor(fixtures: Board["fixtures"]): Board["stats"] {
  const predicted = fixtures.filter((fixture) => fixture.prediction);
  if (predicted.length === 0) {
    return { ...emptyStats(), fixtures: fixtures.length };
  }
  const yesPicks = predicted.filter((fixture) => fixture.prediction?.pick === "YES").length;
  const highConviction = predicted.filter(
    (fixture) => fixture.prediction?.conviction === "HIGH",
  ).length;
  const probabilitySum = predicted.reduce(
    (sum, fixture) => sum + (fixture.prediction?.probabilityYes ?? 0),
    0,
  );
  const goalsSum = predicted.reduce(
    (sum, fixture) => sum + (fixture.prediction?.expectedGoals.total ?? 0),
    0,
  );

  return {
    fixtures: fixtures.length,
    yesPicks,
    noPicks: predicted.length - yesPicks,
    highConviction,
    avgProbabilityYes: probabilitySum / predicted.length,
    avgExpectedGoals: goalsSum / predicted.length,
  };
}

export function applyFilters(
  fixtures: Board["fixtures"],
  filters: BoardFilters,
): Board["fixtures"] {
  const query = filters.query.trim().toLowerCase();
  return fixtures.filter((fixture) => {
    if (
      filters.competitions.length > 0 &&
      !filters.competitions.includes(fixture.match.competitionCode)
    ) {
      return false;
    }
    if (filters.pick !== "ALL" && fixture.prediction?.pick !== filters.pick) return false;
    if (filters.conviction !== "ALL" && fixture.prediction?.conviction !== filters.conviction) {
      return false;
    }
    if (query) {
      const haystack = `${fixture.match.homeTeam.name} ${fixture.match.awayTeam.name} ${fixture.competition.name}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

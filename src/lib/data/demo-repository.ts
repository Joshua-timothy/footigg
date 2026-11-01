import { MODEL, SYNC } from "@/lib/constants";
import { getDemoDataset } from "@/lib/data/demo-data";
import { buildLeagueOverviews } from "@/lib/data/overview";
import { PredictionFactory } from "@/lib/data/prediction-factory";
import { applyFilters, statsFor, type FootballRepository } from "@/lib/data/repository";
import {
  buildCalibration,
  calibrationError,
  computeHeadToHead,
  scorePrediction,
} from "@/lib/prediction";
import { toDateKey } from "@/lib/format";
import type {
  Board,
  BoardFilters,
  CompetitionCode,
  CompetitionMeta,
  Conviction,
  LeagueAccuracy,
  LeagueOverview,
  MatchDetail,
  MatchRecord,
  PerformanceReport,
  Prediction,
  SyncStatus,
} from "@/types/domain";

export class DemoRepository implements FootballRepository {
  readonly source = "demo" as const;
  private readonly dataset = getDemoDataset();
  private readonly competitionMap: Map<CompetitionCode, CompetitionMeta>;
  private readonly factories = new Map<string, PredictionFactory>();

  constructor() {
    this.competitionMap = new Map(
      this.dataset.competitions.map((competition) => [competition.code, competition]),
    );
  }

  private factoryFor(asOf: Date): PredictionFactory {
    const key = asOf.toISOString().slice(0, 13);
    const cached = this.factories.get(key);
    if (cached) return cached;
    const factory = new PredictionFactory(this.dataset.matches, {
      asOf,
      competitions: this.competitionMap,
    });
    this.factories.set(key, factory);
    return factory;
  }

  private predictionFor(match: MatchRecord): Prediction | null {
    const stored = this.dataset.predictions.get(match.id);
    if (stored) return stored;
    if (match.status === "FINISHED") return null;
    const now = new Date();
    const cutoff = new Date(Math.min(now.getTime(), new Date(match.kickoff).getTime()));
    return this.factoryFor(cutoff).predict(match);
  }

  async getCompetitions(): Promise<CompetitionMeta[]> {
    return this.dataset.competitions;
  }

  async getBoard(filters: BoardFilters): Promise<Board> {
    const now = new Date();
    const onDate = this.dataset.matches.filter(
      (match) => toDateKey(match.kickoff) === filters.date,
    );

    const fixtures = onDate.map((match) => {
      const stored = this.dataset.predictions.get(match.id);
      return {
        match,
        competition:
          this.competitionMap.get(match.competitionCode) ?? this.dataset.competitions[0],
        prediction: this.predictionFor(match),
        persisted: Boolean(stored),
      };
    });

    const filtered = applyFilters(fixtures, filters);

    return {
      date: filters.date,
      fixtures: filtered,
      totalOnDate: onDate.length,
      competitions: this.dataset.competitions,
      stats: statsFor(filtered),
      generatedAt: now.toISOString(),
      source: "demo",
      freshness: {
        lastSyncAt: this.dataset.generatedAt,
        stale: false,
        mode: "demo",
      },
    };
  }

  async getMatchDetail(id: number): Promise<MatchDetail | null> {
    const match = this.dataset.matches.find((candidate) => candidate.id === id);
    if (!match) return null;

    const now = new Date();
    const cutoff = new Date(Math.min(now.getTime(), new Date(match.kickoff).getTime()));
    const stored = this.dataset.predictions.get(match.id);
    const prediction = stored ?? (match.status === "FINISHED" ? null : this.factoryFor(cutoff).predict(match));
    const h2h = computeHeadToHead(
      match.homeTeam.id,
      match.awayTeam.id,
      this.dataset.matches,
      cutoff,
    );

    return {
      match,
      prediction,
      competition:
        this.competitionMap.get(match.competitionCode) ?? this.dataset.competitions[0],
      h2h,
      resolved: {
        actualBtts: match.btts,
        correct:
          stored && match.btts !== null
            ? (stored.probabilityYes >= 0.5) === match.btts
            : null,
      },
      persisted: Boolean(stored),
    };
  }

  async getPerformance(): Promise<PerformanceReport> {
    const resolved = this.dataset.resolved;

    let hits = 0;
    let brierSum = 0;
    let logLossSum = 0;
    let probabilitySum = 0;
    let bttsSum = 0;

    const leagueMap = new Map<CompetitionCode, LeagueAccuracy>();
    const convictionMap = new Map<Conviction, { resolved: number; hits: number }>();

    for (const row of resolved) {
      const scored = scorePrediction(row.probabilityYes, row.actualBtts);
      if (scored.correct) hits += 1;
      brierSum += scored.brier;
      logLossSum += scored.logLoss;
      probabilitySum += row.probabilityYes;
      bttsSum += row.actualBtts ? 1 : 0;

      const league = leagueMap.get(row.competitionCode) ?? {
        competitionCode: row.competitionCode,
        name: row.competitionName,
        resolved: 0,
        hits: 0,
        accuracy: 0,
        brier: 0,
      };
      league.resolved += 1;
      if (scored.correct) league.hits += 1;
      league.brier += scored.brier;
      leagueMap.set(row.competitionCode, league);

      const conviction = convictionMap.get(row.conviction) ?? { resolved: 0, hits: 0 };
      conviction.resolved += 1;
      if (scored.correct) conviction.hits += 1;
      convictionMap.set(row.conviction, conviction);
    }

    const total = resolved.length;
    const calibration = buildCalibration(
      resolved.map((row) => ({ probabilityYes: row.probabilityYes, actualBtts: row.actualBtts })),
    );

    return {
      modelVersion: MODEL.version,
      since: resolved.length > 0 ? resolved[resolved.length - 1].kickoff : null,
      totalResolved: total,
      hits,
      accuracy: total > 0 ? hits / total : 0,
      brier: total > 0 ? brierSum / total : 0,
      logLoss: total > 0 ? logLossSum / total : 0,
      avgProbabilityYes: total > 0 ? probabilitySum / total : 0,
      actualBttsRate: total > 0 ? bttsSum / total : 0,
      calibration,
      calibrationError: calibrationError(calibration),
      byLeague: Array.from(leagueMap.values())
        .map((league) => ({
          ...league,
          accuracy: league.resolved > 0 ? league.hits / league.resolved : 0,
          brier: league.resolved > 0 ? league.brier / league.resolved : 0,
        }))
        .sort((a, b) => b.resolved - a.resolved),
      byConviction: (["HIGH", "MEDIUM", "LOW"] as const)
        .map((conviction) => {
          const entry = convictionMap.get(conviction) ?? { resolved: 0, hits: 0 };
          return {
            conviction,
            resolved: entry.resolved,
            hits: entry.hits,
            accuracy: entry.resolved > 0 ? entry.hits / entry.resolved : 0,
          };
        })
        .filter((entry) => entry.resolved > 0),
      recent: resolved.slice(0, 24),
      hasSignal: total >= 10,
    };
  }

  async getLeagueOverview(): Promise<LeagueOverview[]> {
    return buildLeagueOverviews(
      this.dataset.matches,
      this.dataset.competitions,
      new Date(),
      SYNC.lookaheadDays * 86_400_000,
    );
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return {
      lastRun: null,
      lastSuccessAt: this.dataset.generatedAt,
      stale: false,
      staleAfterMinutes: SYNC.staleAfterMinutes,
      requestsLastMinute: 0,
      requestsPerMinuteBudget: SYNC.requestsPerMinute,
      apiConfigured: false,
      databaseConfigured: false,
      mode: "demo",
      nextRunHint: "Deterministic demo season — no API calls, no database",
    };
  }
}

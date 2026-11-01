import { COMPETITIONS } from "@/lib/constants";
import { PredictionFactory } from "@/lib/data/prediction-factory";
import { createRng, hashString, clamp, initials } from "@/lib/utils";
import { toDateKey } from "@/lib/format";
import type {
  CompetitionCode,
  CompetitionMeta,
  MatchRecord,
  Prediction,
  ResolvedPrediction,
  TeamRef,
} from "@/types/domain";

/**
 * Deterministic demo season.
 *
 * Used when no database/API key is configured (and for local UI work). The
 * fixtures are synthetic, but the predictions come from the exact same engine
 * as production — so the demo is a real backtest of the model, not a mock.
 */

const TEAM_NAMES: Record<CompetitionCode, string[]> = {
  PL: [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
    "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
    "Man City", "Man United", "Newcastle", "Nott'm Forest", "Southampton",
    "Tottenham", "West Ham", "Wolves",
  ],
  PD: [
    "Alavés", "Athletic Club", "Atlético Madrid", "Barcelona", "Celta Vigo",
    "Espanyol", "Getafe", "Girona", "Las Palmas", "Leganés", "Mallorca",
    "Osasuna", "Rayo Vallecano", "Real Betis", "Real Madrid", "Real Sociedad",
    "Sevilla", "Valencia", "Valladolid", "Villarreal",
  ],
  SA: [
    "Atalanta", "Bologna", "Cagliari", "Como", "Empoli", "Fiorentina", "Genoa",
    "Hellas Verona", "Inter", "Juventus", "Lazio", "Lecce", "Milan", "Monza",
    "Napoli", "Parma", "Roma", "Torino", "Udinese", "Venezia",
  ],
  BL1: [
    "Augsburg", "Bayer Leverkusen", "Bayern Munich", "Bochum",
    "Borussia Dortmund", "Borussia M'gladbach", "Eintracht Frankfurt",
    "Freiburg", "Heidenheim", "Hoffenheim", "Holstein Kiel", "Mainz 05",
    "RB Leipzig", "St. Pauli", "Stuttgart", "Union Berlin", "Werder Bremen",
    "Wolfsburg",
  ],
  FL1: [
    "Angers", "Auxerre", "Brest", "Le Havre", "Lens", "Lille", "Lyon",
    "Marseille", "Monaco", "Montpellier", "Nantes", "Nice", "Paris SG",
    "Reims", "Rennes", "Strasbourg", "Toulouse", "Saint-Étienne",
  ],
  ELC: [
    "Blackburn", "Bristol City", "Burnley", "Cardiff", "Coventry", "Derby",
    "Hull", "Leeds", "Luton", "Middlesbrough", "Millwall", "Norwich",
    "Oxford United", "Plymouth", "Portsmouth", "Preston", "QPR",
    "Sheffield Utd", "Sheffield Wed", "Stoke", "Sunderland", "Swansea",
    "Watford", "West Brom",
  ],
  DED: [
    "Ajax", "Almere City", "AZ Alkmaar", "Feyenoord", "Fortuna Sittard",
    "Go Ahead Eagles", "Groningen", "Heerenveen", "Heracles", "NAC Breda",
    "NEC Nijmegen", "PEC Zwolle", "PSV", "RKC Waalwijk", "Sparta Rotterdam",
    "Twente", "Utrecht", "Willem II",
  ],
  PPL: [
    "Arouca", "AVS", "Benfica", "Boavista", "Braga", "Casa Pia", "Estoril",
    "Estrela Amadora", "Famalicão", "Farense", "Gil Vicente", "Moreirense",
    "Nacional", "Porto", "Rio Ave", "Santa Clara", "Sporting CP", "Vitória SC",
  ],
  BSA: [
    "Athletico-PR", "Atlético-MG", "Bahia", "Botafogo", "Bragantino",
    "Corinthians", "Criciúma", "Cruzeiro", "Cuiabá", "Flamengo", "Fluminense",
    "Fortaleza", "Grêmio", "Internacional", "Juventude", "Palmeiras",
    "São Paulo", "Vasco", "Vitória", "Atlético-GO",
  ],
  CL: [],
};

const CL_CLUBS = [
  "Real Madrid", "Man City", "Bayern Munich", "Paris SG", "Inter", "Arsenal",
  "Barcelona", "Liverpool", "Bayer Leverkusen", "Atlético Madrid", "Juventus",
  "Benfica", "Sporting CP", "PSV", "Ajax", "Porto",
];

/** Day offsets relative to today for each synthetic matchday. */
const ROUND_OFFSETS = [
  -70, -63, -56, -49, -42, -35, -28, -24, -21, -17, -14, -11, -7, -4, -2, -1, 0, 1, 2, 4, 7, 9,
  11,
];
const TODAY_ROUND = 16;
const PREDICTED_ROUNDS = new Set([13, 14, 15, 16, 17, 18]);
const KICKOFFS: Array<[number, number]> = [
  [11, 30],
  [14, 0],
  [16, 30],
  [19, 0],
];

interface DemoDataset {
  key: string;
  generatedAt: string;
  competitions: CompetitionMeta[];
  matches: MatchRecord[];
  predictions: Map<number, Prediction>;
  resolved: ResolvedPrediction[];
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function samplePoisson(lambda: number, rng: () => number): number {
  const limit = Math.exp(-Math.max(lambda, 0.01));
  let product = 1;
  let goals = 0;
  do {
    goals += 1;
    product *= rng();
  } while (product > limit && goals < 12);
  return goals - 1;
}

/** Circle-method round robin. */
function circleMethod(teams: TeamRef[]): Array<Array<[TeamRef, TeamRef]>> {
  const list = [...teams];
  if (list.length % 2 !== 0) return [];
  const rounds: Array<Array<[TeamRef, TeamRef]>> = [];
  const size = list.length;

  for (let round = 0; round < size - 1; round += 1) {
    const pairs: Array<[TeamRef, TeamRef]> = [];
    for (let i = 0; i < size / 2; i += 1) {
      const first = list[i];
      const second = list[size - 1 - i];
      if (!first || !second) continue;
      pairs.push(round % 2 === 0 ? [first, second] : [second, first]);
    }
    rounds.push(pairs);
    const last = list.pop();
    if (last) list.splice(1, 0, last);
  }

  return rounds;
}

function teamTla(name: string): string {
  return (initials(name) || name.slice(0, 3)).slice(0, 3).toUpperCase();
}

function buildDataset(key: string): DemoDataset {
  const now = new Date();
  const todayKey = toDateKey(now);
  const today = new Date(`${todayKey}T00:00:00Z`);
  const season = today.getUTCMonth() >= 5 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;

  const competitions: CompetitionMeta[] = COMPETITIONS.map((competition) => ({
    ...competition,
    season,
  }));
  const competitionMap = new Map(competitions.map((competition) => [competition.code, competition]));

  const teamsByCompetition = new Map<CompetitionCode, TeamRef[]>();
  const teamByName = new Map<string, TeamRef>();
  const strength = new Map<number, { attack: number; defence: number }>();

  competitions.forEach((competition, competitionIndex) => {
    const names = TEAM_NAMES[competition.code];
    if (names.length === 0) return;

    const teams = names.map((name, index) => {
      const id = 1000 + competitionIndex * 200 + index;
      const team: TeamRef = {
        id,
        name,
        shortName: name,
        tla: teamTla(name),
        crest: null,
      };
      teamByName.set(name, team);

      const rng = createRng(hashString(`${competition.code}:${name}`));
      const rank = index / Math.max(names.length - 1, 1);
      const quality = 1.16 - rank * 0.4 + (rng() - 0.5) * 0.06;
      strength.set(id, {
        attack: quality * (0.95 + rng() * 0.1),
        defence: (1 / quality) * (0.95 + rng() * 0.1),
      });
      return team;
    });

    teamsByCompetition.set(competition.code, teams);
  });

  const matches: MatchRecord[] = [];
  const roundBuckets = new Map<number, MatchRecord[]>();

  const pushMatch = (match: MatchRecord, round: number) => {
    matches.push(match);
    const bucket = roundBuckets.get(round);
    if (bucket) bucket.push(match);
    else roundBuckets.set(round, [match]);
  };

  const makeMatch = (args: {
    id: number;
    competitionCode: CompetitionCode;
    round: number;
    matchIndex: number;
    home: TeamRef;
    away: TeamRef;
  }): MatchRecord => {
    const { id, competitionCode, round, matchIndex, home, away } = args;
    const date = addDays(today, ROUND_OFFSETS[round] ?? 0);
    const [hour, minute] = KICKOFFS[matchIndex % KICKOFFS.length];
    const kickoff = new Date(date);
    kickoff.setUTCHours(hour, minute, 0, 0);

    const homeStrength = strength.get(home.id) ?? { attack: 1, defence: 1 };
    const awayStrength = strength.get(away.id) ?? { attack: 1, defence: 1 };
    const lambdaHome = clamp(1.5 * homeStrength.attack * awayStrength.defence, 0.25, 4);
    const lambdaAway = clamp(1.18 * awayStrength.attack * homeStrength.defence, 0.2, 3.6);

    const rng = createRng(hashString(`${competitionCode}:${round}:${home.id}:${away.id}`));
    const homeGoals = Math.min(7, samplePoisson(lambdaHome, rng));
    const awayGoals = Math.min(7, samplePoisson(lambdaAway, rng));
    const finished = kickoff.getTime() <= now.getTime();

    return {
      id,
      competitionCode,
      season,
      matchday: round + 1,
      stage: competitionCode === "CL" ? "LEAGUE_STAGE" : "REGULAR_SEASON",
      kickoff: kickoff.toISOString(),
      status: finished ? "FINISHED" : "TIMED",
      homeTeam: home,
      awayTeam: away,
      score: {
        home: finished ? homeGoals : null,
        away: finished ? awayGoals : null,
        htHome: finished ? Math.min(homeGoals, Math.round(homeGoals * 0.45)) : null,
        htAway: finished ? Math.min(awayGoals, Math.round(awayGoals * 0.45)) : null,
      },
      winner: finished
        ? homeGoals > awayGoals
          ? "HOME_TEAM"
          : homeGoals === awayGoals
            ? "DRAW"
            : "AWAY_TEAM"
        : null,
      btts: finished ? homeGoals > 0 && awayGoals > 0 : null,
    };
  };

  competitions.forEach((competition, competitionIndex) => {
    const teams = teamsByCompetition.get(competition.code);
    if (!teams) return;
    const rounds = circleMethod(teams);

    for (let round = 0; round < ROUND_OFFSETS.length; round += 1) {
      const pairs = rounds[round % rounds.length] ?? [];
      pairs.forEach(([home, away], matchIndex) => {
        pushMatch(
          makeMatch({
            id: 1_000_000 + competitionIndex * 100_000 + round * 1_000 + matchIndex,
            competitionCode: competition.code,
            round,
            matchIndex,
            home,
            away,
          }),
          round,
        );
      });
    }
  });

  // Champions League: reuses domestic clubs so ratings stay meaningful.
  const clTeams = CL_CLUBS.map((name) => teamByName.get(name)).filter(
    (team): team is TeamRef => Boolean(team),
  );
  const clRounds = circleMethod(clTeams);
  for (const round of [8, 9, 10]) {
    const pairs = clRounds[round % Math.max(clRounds.length, 1)] ?? [];
    pairs.forEach(([home, away], matchIndex) => {
      pushMatch(
        makeMatch({
          id: 2_000_000 + round * 100 + matchIndex,
          competitionCode: "CL",
          round,
          matchIndex,
          home,
          away,
        }),
        round,
      );
    });
  }

  matches.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  const factoryCache = new Map<string, PredictionFactory>();
  const factoryFor = (asOf: Date, suffix: string) => {
    const cacheKey = `${asOf.toISOString().slice(0, 10)}:${suffix}`;
    const cached = factoryCache.get(cacheKey);
    if (cached) return cached;
    const factory = new PredictionFactory(matches, { asOf, competitions: competitionMap });
    factoryCache.set(cacheKey, factory);
    return factory;
  };

  const predictions = new Map<number, Prediction>();
  for (const round of Array.from(PREDICTED_ROUNDS).sort((a, b) => a - b)) {
    const bucket = roundBuckets.get(round) ?? [];
    if (bucket.length === 0) continue;
    const asOf =
      round <= TODAY_ROUND
        ? addDays(today, ROUND_OFFSETS[round] ?? 0)
        : now;
    const factory = factoryFor(asOf, round <= TODAY_ROUND ? `round-${round}` : "now");
    for (const match of bucket) {
      predictions.set(match.id, factory.predict(match));
    }
  }

  const resolved: ResolvedPrediction[] = [];
  for (const match of matches) {
    const prediction = predictions.get(match.id);
    if (!prediction || match.status !== "FINISHED" || match.btts === null) continue;
    const competition = competitionMap.get(match.competitionCode);
    resolved.push({
      matchId: match.id,
      competitionCode: match.competitionCode,
      competitionName: competition?.shortName ?? match.competitionCode,
      kickoff: match.kickoff,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      score: match.score,
      pick: prediction.pick,
      conviction: prediction.conviction,
      probabilityYes: prediction.probabilityYes,
      actualBtts: match.btts,
      correct: (prediction.probabilityYes >= 0.5) === match.btts,
    });
  }
  resolved.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());

  return {
    key,
    generatedAt: now.toISOString(),
    competitions,
    matches,
    predictions,
    resolved,
  };
}

const globalStore = globalThis as unknown as { __footiggDemo?: DemoDataset };
const DEMO_VERSION = 4;

export function getDemoDataset(): DemoDataset {
  const key = `${DEMO_VERSION}:${toDateKey()}-${new Date().getUTCHours()}`;
  if (globalStore.__footiggDemo?.key === key) return globalStore.__footiggDemo;
  const dataset = buildDataset(key);
  globalStore.__footiggDemo = dataset;
  return dataset;
}

import { unstable_cache } from "next/cache";
import { SYNC } from "@/lib/constants";
import { flags } from "@/lib/env";
import { getRepository } from "@/lib/data";
import type { Board, BoardFilters } from "@/types/domain";

const isDev = process.env.NODE_ENV === "development";

/**
 * Data access with a second cache layer on top of Postgres.
 *
 * Vercel Hobby only allows a daily cron, so the app stays inside the free
 * football-data.org budget by (a) syncing lazily every 30 minutes and
 * (b) caching rendered data for 15 minutes.
 */
const cachedBoard = unstable_cache(
  async (filters: BoardFilters) => getRepository().getBoard(filters),
  ["board"],
  { revalidate: SYNC.revalidateSeconds, tags: ["board"] },
);

const cachedMatch = unstable_cache(
  async (id: number) => getRepository().getMatchDetail(id),
  ["match"],
  { revalidate: SYNC.revalidateSeconds, tags: ["board"] },
);

const cachedPerformance = unstable_cache(
  async () => getRepository().getPerformance(),
  ["performance"],
  { revalidate: SYNC.revalidateSeconds, tags: ["board"] },
);

const cachedLeagues = unstable_cache(
  async () => getRepository().getLeagueOverview(),
  ["leagues"],
  { revalidate: SYNC.revalidateSeconds, tags: ["board"] },
);

const cachedStatus = unstable_cache(
  async () => getRepository().getSyncStatus(),
  ["sync-status"],
  { revalidate: 60, tags: ["board"] },
);

export async function getBoardData(filters: BoardFilters): Promise<Board> {
  return isDev ? getRepository().getBoard(filters) : cachedBoard(filters);
}

export async function getMatchData(id: number) {
  return isDev ? getRepository().getMatchDetail(id) : cachedMatch(id);
}

export async function getPerformanceData() {
  return isDev ? getRepository().getPerformance() : cachedPerformance();
}

export async function getLeagueData() {
  return isDev ? getRepository().getLeagueOverview() : cachedLeagues();
}

export async function getStatusData() {
  return isDev ? getRepository().getSyncStatus() : cachedStatus();
}

export const dataMode = flags.demo ? "demo" : "live";

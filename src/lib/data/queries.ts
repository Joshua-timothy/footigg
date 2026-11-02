import { unstable_cache } from "next/cache";
import { SYNC } from "@/lib/constants";
import { flags } from "@/lib/env";
import { getRepository } from "@/lib/data";
import type { Board, BoardFilters } from "@/types/domain";

const isDev = process.env.NODE_ENV === "development";

/**
 * Bump this whenever the shape of a cached value changes (or when a bad entry
 * needs to be flushed). Next's `unstable_cache` keeps serving the previous entry
 * while it revalidates in the background, so an entry written by an older build
 * can outlive a deploy and fail to deserialize in the new one. Including a
 * version in `keyParts` makes the new build read a fresh key instead.
 */
const CACHE_VERSION = "v2";

/**
 * Data access with a second cache layer on top of Postgres.
 *
 * Vercel Hobby only allows a daily cron, so the app stays inside the free
 * football-data.org budget by (a) syncing lazily every 30 minutes and
 * (b) caching rendered data for 15 minutes.
 *
 * Match details are deliberately *not* cached: each one is a single fixture,
 * costs three indexed queries, and is only reachable from a page that is
 * already dynamic. Caching them bought nothing but a way for stale shapes to
 * break a page after a deploy.
 */
const cachedBoard = unstable_cache(
  async (filters: BoardFilters) => getRepository().getBoard(filters),
  [`${CACHE_VERSION}:board`],
  { revalidate: SYNC.revalidateSeconds, tags: ["board"] },
);

const cachedPerformance = unstable_cache(
  async () => getRepository().getPerformance(),
  [`${CACHE_VERSION}:performance`],
  { revalidate: SYNC.revalidateSeconds, tags: ["board"] },
);

const cachedLeagues = unstable_cache(
  async () => getRepository().getLeagueOverview(),
  [`${CACHE_VERSION}:leagues`],
  { revalidate: SYNC.revalidateSeconds, tags: ["board"] },
);

const cachedStatus = unstable_cache(
  async () => getRepository().getSyncStatus(),
  [`${CACHE_VERSION}:sync-status`],
  { revalidate: 60, tags: ["board"] },
);

export async function getBoardData(filters: BoardFilters): Promise<Board> {
  return isDev ? getRepository().getBoard(filters) : cachedBoard(filters);
}

export async function getMatchData(id: number) {
  return getRepository().getMatchDetail(id);
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

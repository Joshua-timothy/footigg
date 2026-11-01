import { prisma } from "@/lib/db/prisma";
import { flags } from "@/lib/env";
import { SYNC } from "@/lib/constants";

export interface BudgetState {
  /** Requests recorded in the last 60 seconds. */
  used: number;
  /** Hard plan limit. */
  budget: number;
  /** Requests we still allow ourselves inside the safe window. */
  remaining: number;
  retryInMs: number;
}

/**
 * football-data.org's free plan allows 10 requests per minute. We keep a
 * ledger of every call in Postgres so the limit is respected even across
 * serverless instances and cold starts.
 */
export async function getBudgetState(): Promise<BudgetState> {
  if (!flags.database) {
    return {
      used: 0,
      budget: SYNC.requestsPerMinute,
      remaining: SYNC.safeRequestsPerMinute,
      retryInMs: 0,
    };
  }

  try {
    const since = new Date(Date.now() - 60_000);
    const used = await prisma.apiRequest.count({ where: { createdAt: { gte: since } } });
    const remaining = Math.max(0, SYNC.safeRequestsPerMinute - used);
    return {
      used,
      budget: SYNC.requestsPerMinute,
      remaining,
      retryInMs: remaining > 0 ? 0 : 20_000,
    };
  } catch {
    return {
      used: 0,
      budget: SYNC.requestsPerMinute,
      remaining: SYNC.safeRequestsPerMinute,
      retryInMs: 0,
    };
  }
}

export async function recordApiRequest(
  endpoint: string,
  statusCode: number,
  durationMs: number,
): Promise<void> {
  if (!flags.database) return;
  try {
    await prisma.apiRequest.create({ data: { endpoint, statusCode, durationMs } });
  } catch {
    // Budget telemetry must never break a request.
  }
}

/** Keeps the ledger table tiny (well under the free-tier row budget). */
export async function pruneApiRequests(): Promise<void> {
  if (!flags.database) return;
  try {
    await prisma.apiRequest.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    });
  } catch {
    // ignore
  }
}

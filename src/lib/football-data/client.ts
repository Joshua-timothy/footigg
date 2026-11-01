import { env } from "@/lib/env";
import { getBudgetState, recordApiRequest } from "@/lib/football-data/budget";

const BASE_URL = "https://api.football-data.org/v4";
const DEFAULT_TIMEOUT_MS = 12_000;

export class FootballDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "FootballDataError";
  }
}

export interface FootballDataRequestOptions {
  params?: Record<string, string | number | undefined | null>;
  timeoutMs?: number;
  /** Retries only happen on 429 or network errors. */
  retries?: number;
}

function buildUrl(endpoint: string, params?: FootballDataRequestOptions["params"]): URL {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Thin, budget-aware wrapper around the free football-data.org API.
 * Every call is logged so the 10/minute plan limit can be enforced.
 */
export async function footballDataFetch<T>(
  endpoint: string,
  options: FootballDataRequestOptions = {},
): Promise<T> {
  const apiKey = env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new FootballDataError("FOOTBALL_DATA_API_KEY is not configured", 0, endpoint);
  }

  const budget = await getBudgetState();
  if (budget.remaining <= 0) {
    throw new FootballDataError(
      "Local rate limit reached — refusing to call football-data.org",
      429,
      endpoint,
    );
  }

  const url = buildUrl(endpoint, options.params);
  const retries = options.retries ?? 1;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        headers: {
          "X-Auth-Token": apiKey,
          Accept: "application/json",
        },
        // Caching is handled deliberately in Postgres, never implicitly.
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });

      await recordApiRequest(endpoint, response.status, Date.now() - startedAt);

      if (response.status === 429 && attempt < retries) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 8) * 1000 : 4_000);
        attempt += 1;
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new FootballDataError(
          `football-data.org responded ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
          response.status,
          endpoint,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      const isNetwork = error instanceof TypeError || isAbort;
      if (isNetwork && attempt < retries) {
        await sleep(1_500 * (attempt + 1));
        attempt += 1;
        continue;
      }
      break;
    }
  }

  if (lastError instanceof FootballDataError) throw lastError;
  throw new FootballDataError(
    lastError instanceof Error ? lastError.message : "Unknown football-data.org error",
    0,
    endpoint,
  );
}

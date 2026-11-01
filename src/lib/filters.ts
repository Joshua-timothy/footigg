import { MAX_FILTERS } from "@/lib/constants";
import { toDateKey } from "@/lib/format";
import { COMPETITION_CODES } from "@/types/domain";
import type { BoardFilters, CompetitionCode, Conviction, PickSide } from "@/types/domain";

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isCompetitionCode(value: string): value is CompetitionCode {
  return (COMPETITION_CODES as readonly string[]).includes(value);
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

export function parseBoardFilters(params: SearchParams): BoardFilters {
  const dateParam = first(params.date);
  const date = dateParam && isDateKey(dateParam) ? dateParam : toDateKey();

  const competitions = Array.from(
    new Set(
      (first(params.comp) ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(isCompetitionCode),
    ),
  ).slice(0, MAX_FILTERS.competitions);

  const pickParam = first(params.pick);
  const pick: BoardFilters["pick"] =
    pickParam === "YES" || pickParam === "NO" ? (pickParam as PickSide) : "ALL";

  const convictionParam = first(params.conviction)?.toUpperCase();
  const conviction: BoardFilters["conviction"] =
    convictionParam === "HIGH" || convictionParam === "MEDIUM" || convictionParam === "LOW"
      ? (convictionParam as Conviction)
      : "ALL";

  const query = (first(params.q) ?? "").slice(0, MAX_FILTERS.queryLength).trim();

  return { date, competitions, pick, conviction, query };
}

/** Serialises filters into a canonical query string (defaults omitted). */
export function boardQuery(filters: BoardFilters): string {
  const params = new URLSearchParams();
  if (filters.date !== toDateKey()) params.set("date", filters.date);
  if (filters.competitions.length > 0) params.set("comp", filters.competitions.join(","));
  if (filters.pick !== "ALL") params.set("pick", filters.pick);
  if (filters.conviction !== "ALL") params.set("conviction", filters.conviction);
  if (filters.query) params.set("q", filters.query);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  return (
    filters.competitions.length > 0 ||
    filters.pick !== "ALL" ||
    filters.conviction !== "ALL" ||
    filters.query.length > 0
  );
}

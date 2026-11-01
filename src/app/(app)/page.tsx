import type { Metadata } from "next";
import { after } from "next/server";
import { Badge } from "@/components/ui/badge";
import { BoardStats } from "@/components/fixtures/board-stats";
import { DateNav } from "@/components/fixtures/date-nav";
import { FilterBar } from "@/components/fixtures/filter-bar";
import { FixtureBoard } from "@/components/fixtures/fixture-board";
import { ModelDialog } from "@/components/shared/model-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { dayLabel, formatDateKey, relativeTime, toDateKey } from "@/lib/format";
import { parseBoardFilters, type SearchParams } from "@/lib/filters";
import { getBoardData } from "@/lib/data/queries";
import { maybeLazySync } from "@/lib/sync/sync-service";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "GG board" };

// Lazy sync runs in after(); allow the full Hobby function budget.
export const maxDuration = 60;

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseBoardFilters(await searchParams);
  const board = await getBoardData(filters);

  // Stale-while-revalidate: keep the free API inside 10 requests/minute by
  // only syncing when the last run is old enough.
  after(async () => {
    try {
      await maybeLazySync("board-view");
    } catch {
      // Never surface background sync failures to the reader.
    }
  });

  const today = toDateKey();
  const label = dayLabel(filters.date, today);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              GG board
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tightest">{label}</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {formatDateKey(filters.date)} · both teams to score picks for the ten free
            football-data.org competitions, with the working shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {board.source === "demo" ? <Badge variant="warning">Demo season</Badge> : null}
          {board.freshness.stale ? <Badge variant="outline">Data stale</Badge> : null}
          <ModelDialog />
        </div>
      </header>

      <BoardStats stats={board.stats} totalOnDate={board.totalOnDate} />

      <div className="space-y-3">
        <DateNav filters={filters} />
        <FilterBar filters={filters} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[10px] text-muted-foreground">
        <span className="num">
          {board.fixtures.length} of {board.totalOnDate} fixtures
        </span>
        <span>Updated {relativeTime(board.freshness.lastSyncAt)}</span>
      </div>

      {board.fixtures.length > 0 ? (
        <FixtureBoard fixtures={board.fixtures} />
      ) : (
        <EmptyState
          title="Nothing here yet"
          description={
            board.totalOnDate > 0
              ? "No fixtures match these filters. Clear them to see the full slate."
              : "No fixtures on this date in the tracked competitions. Try another day."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to today</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

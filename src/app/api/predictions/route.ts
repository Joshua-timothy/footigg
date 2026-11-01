import { NextResponse, type NextRequest } from "next/server";
import { parseBoardFilters } from "@/lib/filters";
import { getBoardData, getMatchData } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

/**
 * Read-only JSON view of the same data the board renders.
 * Auth is enforced by middleware; responses are marked private.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");

  if (id) {
    const matchId = Number(id);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
    }
    const detail = await getMatchData(matchId);
    if (!detail) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    return NextResponse.json(
      { match: detail },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const filters = parseBoardFilters(Object.fromEntries(params.entries()));
  const board = await getBoardData(filters);

  return NextResponse.json(
    {
      date: board.date,
      source: board.source,
      generatedAt: board.generatedAt,
      freshness: board.freshness,
      stats: board.stats,
      totalOnDate: board.totalOnDate,
      filters,
      fixtures: board.fixtures,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

import { prisma } from "@/lib/db/prisma";
import { MODEL, SYNC } from "@/lib/constants";
import { toMatchRecord } from "@/lib/data/mappers";
import type { MatchRecord } from "@/types/domain";

export const HISTORY_MS = MODEL.historyDays * 86_400_000;
export const LOOKAHEAD_MS = SYNC.lookaheadDays * 86_400_000;

/**
 * One query returns everything the prediction engine needs: enough history to
 * fit ratings and every fixture inside the look-ahead window. At ~4,000 rows
 * this is a few hundred KB — far cheaper than N per-team queries.
 */
export async function loadMatchWindow(now: Date = new Date()): Promise<MatchRecord[]> {
  const rows = await prisma.match.findMany({
    where: {
      kickoff: {
        gte: new Date(now.getTime() - HISTORY_MS),
        lte: new Date(now.getTime() + LOOKAHEAD_MS),
      },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoff: "asc" },
  });
  return rows.map(toMatchRecord);
}

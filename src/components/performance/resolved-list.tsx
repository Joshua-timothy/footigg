import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TeamCrest } from "@/components/shared/team-crest";
import { formatDateTime } from "@/lib/format";
import { cn, pct } from "@/lib/utils";
import type { ResolvedPrediction } from "@/types/domain";

export function ResolvedList({ rows }: { rows: ResolvedPrediction[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No resolved picks yet. This list fills up as fixtures finish.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/[0.07] text-left">
            <th className="pb-2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Kick-off
            </th>
            <th className="pb-2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Fixture
            </th>
            <th className="w-14 pb-2 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Pick
            </th>
            <th className="w-12 pb-2 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              P(GG)
            </th>
            <th className="w-12 pb-2 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Score
            </th>
            <th className="w-14 pb-2 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.map((row) => (
            <tr key={row.matchId} className="transition-colors hover:bg-white/[0.02]">
              <td className="num py-2 text-[10px] text-muted-foreground/60">
                {formatDateTime(row.kickoff)}
              </td>
              <td className="py-2">
                <Link
                  href={`/match/${row.matchId}`}
                  className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <TeamCrest team={row.homeTeam} size="xs" />
                  <span className="truncate text-[11px] text-foreground/85">
                    {row.homeTeam.shortName}
                  </span>
                  <span className="shrink-0 text-[9px] text-muted-foreground/45">v</span>
                  <TeamCrest team={row.awayTeam} size="xs" />
                  <span className="truncate text-[11px] text-foreground/85">
                    {row.awayTeam.shortName}
                  </span>
                </Link>
              </td>
              <td className="py-2 text-right">
                <Badge variant={row.pick === "YES" ? "yes" : "no"}>{row.pick}</Badge>
              </td>
              <td className="num py-2 text-right text-[11px] text-muted-foreground">
                {pct(row.probabilityYes)}
              </td>
              <td className="num py-2 text-right text-[11px] font-medium">
                {row.score.home}–{row.score.away}
              </td>
              <td className="py-2 text-right">
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    row.correct ? "text-yes" : "text-no",
                  )}
                >
                  {row.correct ? "Hit" : "Miss"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

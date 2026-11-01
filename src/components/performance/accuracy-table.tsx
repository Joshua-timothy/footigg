import { cn, pct } from "@/lib/utils";
import type { LeagueAccuracy } from "@/types/domain";

export function AccuracyTable({ leagues }: { leagues: LeagueAccuracy[] }) {
  if (leagues.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No resolved picks yet. Accuracy appears after the first full-time result.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {leagues.map((league) => (
        <div key={league.competitionCode} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-foreground/90">{league.name}</span>
              <span className="num shrink-0 text-[9px] text-muted-foreground/55">
                {league.resolved} picks
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="num text-[9px] text-muted-foreground/60">
                Brier {league.brier.toFixed(3)}
              </span>
              <span
                className={cn(
                  "num text-[11px] font-semibold",
                  league.accuracy >= 0.55
                    ? "text-yes"
                    : league.accuracy < 0.45
                      ? "text-no"
                      : "text-foreground/85",
                )}
              >
                {pct(league.accuracy)}
              </span>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className={cn(
                "h-full rounded-full",
                league.accuracy >= 0.55
                  ? "bg-yes/70"
                  : league.accuracy < 0.45
                    ? "bg-no/65"
                    : "bg-white/30",
              )}
              style={{ width: `${Math.max(3, league.accuracy * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

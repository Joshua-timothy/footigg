import Link from "next/link";
import { cn, pct } from "@/lib/utils";
import type { LeagueOverview } from "@/types/domain";

export function LeagueCard({
  overview,
  selected,
}: {
  overview: LeagueOverview;
  selected: boolean;
}) {
  const { competition, baseline, teams, upcoming, finished } = overview;

  return (
    <Link
      href={`/competitions?league=${competition.code}`}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200",
        selected
          ? "border-primary/35 bg-primary/[0.06]"
          : "border-white/[0.06] bg-card/60 hover:border-white/[0.14] hover:bg-card",
      )}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${competition.accent}, transparent)`,
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-[3px]"
            style={{ backgroundColor: competition.accent }}
          />
          <span className="truncate text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
            {competition.country}
          </span>
        </div>
        <span className="num shrink-0 text-[9px] text-muted-foreground/55">
          {competition.season ?? "—"}
        </span>
      </div>

      <h3 className="mt-2 truncate text-[13px] font-semibold tracking-tight">
        {competition.shortName}
      </h3>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <div>
          <p className="label-caps text-[7px]">Teams</p>
          <p className="num mt-0.5 text-xs font-medium">{teams.length}</p>
        </div>
        <div>
          <p className="label-caps text-[7px]">GG rate</p>
          <p className="num mt-0.5 text-xs font-medium">
            {finished > 0 ? pct(baseline.bttsRate) : "—"}
          </p>
        </div>
        <div>
          <p className="label-caps text-[7px]">Upcoming</p>
          <p className="num mt-0.5 text-xs font-medium">{upcoming}</p>
        </div>
      </div>
    </Link>
  );
}

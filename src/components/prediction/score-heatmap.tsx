import { cn, pct } from "@/lib/utils";
import type { ScoreLine } from "@/types/domain";

export function ScoreHeatmap({
  grid,
  maxGoals = 5,
  topScorelines,
}: {
  grid: number[][];
  maxGoals?: number;
  topScorelines?: ScoreLine[];
}) {
  const cells: number[][] = [];
  let max = 0;
  for (let home = 0; home <= maxGoals; home += 1) {
    const row: number[] = [];
    for (let away = 0; away <= maxGoals; away += 1) {
      const value = grid[home]?.[away] ?? 0;
      row.push(value);
      max = Math.max(max, value);
    }
    cells.push(row);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full grid-cols-[auto_repeat(6,minmax(0,1fr))] gap-1">
          <div className="flex items-end justify-center pb-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">H\A</span>
          </div>
          {Array.from({ length: maxGoals + 1 }).map((_, away) => (
            <div key={`a-${away}`} className="pb-1 text-center text-[10px] text-muted-foreground/60">
              {away}
            </div>
          ))}

          {cells.map((row, home) => (
            <div key={`h-${home}`} className="contents">
              <div className="flex items-center justify-center pr-1 text-[10px] text-muted-foreground/60">
                {home}
              </div>
              {row.map((probability, away) => {
                const intensity = max > 0 ? probability / max : 0;
                const isTop = topScorelines?.some(
                  (line) => line.home === home && line.away === away,
                );
                return (
                  <div
                    key={`${home}-${away}`}
                    title={`${home}-${away} · ${pct(probability, 1)}`}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-[5px] border text-[9px] transition-colors",
                      isTop ? "border-yes/40" : "border-white/[0.04]",
                    )}
                    style={{
                      backgroundColor: `hsl(var(--yes) / ${0.05 + intensity * 0.55})`,
                      color: intensity > 0.45 ? "hsl(160 40% 8%)" : "hsl(150 8% 78%)",
                    }}
                  >
                    <span className="num font-medium">
                      {probability >= 0.005 ? Math.round(probability * 100) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {topScorelines && topScorelines.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {topScorelines.slice(0, 4).map((line) => (
            <span
              key={`${line.home}-${line.away}`}
              className="num inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-muted-foreground"
            >
              <span className="font-medium text-foreground/90">
                {line.home}–{line.away}
              </span>
              {pct(line.probability, 1)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

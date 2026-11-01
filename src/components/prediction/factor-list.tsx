import { cn, pctPoints } from "@/lib/utils";
import type { PredictionFactor } from "@/types/domain";

const KEY_HINT: Record<string, string> = {
  home_attack: "Home attack",
  away_attack: "Away attack",
  home_defence: "Home defence",
  away_defence: "Away defence",
  home_advantage: "Home edge",
  form: "GG form",
  h2h: "H2H",
  low_score: "Low-score fix",
};

export function FactorList({ factors }: { factors: PredictionFactor[] }) {
  const maxImpact = Math.max(...factors.map((factor) => Math.abs(factor.impactPp)), 1);

  return (
    <ul className="divide-y divide-white/[0.05]">
      {factors.map((factor) => {
        const width = (Math.abs(factor.impactPp) / maxImpact) * 100;
        const positive = factor.impactPp > 0;

        return (
          <li key={factor.key} className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium text-foreground">{factor.label}</span>
                <span className="num rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {factor.value}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {KEY_HINT[factor.key]}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground/85">{factor.detail}</p>
            </div>

            <div className="flex w-32 shrink-0 flex-col items-end gap-1.5">
              <span
                className={cn(
                  "num text-xs font-medium",
                  factor.direction === "up"
                    ? "text-yes"
                    : factor.direction === "down"
                      ? "text-no"
                      : "text-muted-foreground",
                )}
              >
                {pctPoints(factor.impactPp)}
              </span>
              <div className="flex h-1.5 w-full items-center">
                <div className="flex h-full flex-1 justify-end">
                  {!positive ? (
                    <div
                      className="h-full rounded-l-full bg-no/70"
                      style={{ width: `${width}%` }}
                    />
                  ) : null}
                </div>
                <div className="h-2.5 w-px bg-white/15" />
                <div className="flex h-full flex-1">
                  {positive ? (
                    <div
                      className="h-full rounded-r-full bg-yes/70"
                      style={{ width: `${width}%` }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { cn } from "@/lib/utils";
import type { FormMatch } from "@/types/domain";

const RESULT_STYLE: Record<string, string> = {
  W: "bg-yes/20 text-yes border-yes/30",
  D: "bg-white/[0.06] text-muted-foreground border-white/10",
  L: "bg-no/15 text-no border-no/30",
};

export function FormDots({ results }: { results: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {results.slice(0, 5).map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-[4px] border text-[9px] font-semibold",
            RESULT_STYLE[result] ?? RESULT_STYLE.D,
          )}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

/** Five most recent matches, oldest on the left; filled = both teams scored. */
export function BttsDots({ matches }: { matches: FormMatch[] }) {
  const recent = [...matches].slice(0, 5).reverse();
  if (recent.length === 0) {
    return <span className="text-2xs text-muted-foreground/60">no data</span>;
  }
  return (
    <div className="flex items-center gap-1" aria-label="Recent both-teams-to-score record">
      {recent.map((match) => (
        <span
          key={match.matchId}
          title={`${match.venue} vs ${match.opponent}: ${match.goalsFor}-${match.goalsAgainst}`}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            match.btts ? "bg-yes/80" : "bg-white/15",
          )}
        />
      ))}
    </div>
  );
}

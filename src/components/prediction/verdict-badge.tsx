import { cn, pct } from "@/lib/utils";
import type { Conviction, PickSide } from "@/types/domain";

const CONVICTION_LABEL: Record<Conviction, string> = {
  HIGH: "High conviction",
  MEDIUM: "Medium",
  LOW: "Coin-flip",
};

const CONVICTION_STYLE: Record<Conviction, string> = {
  HIGH: "text-primary",
  MEDIUM: "text-amber-300",
  LOW: "text-muted-foreground",
};

export function VerdictBadge({
  pick,
  probability,
  conviction,
  className,
  size = "md",
}: {
  pick: PickSide;
  probability: number;
  conviction: Conviction;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const isYes = pick === "YES";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg border",
        size === "lg" ? "px-3.5 py-2.5" : size === "sm" ? "px-2 py-1" : "px-2.5 py-1.5",
        isYes ? "border-yes/25 bg-yes/[0.08]" : "border-no/25 bg-no/[0.08]",
        className,
      )}
    >
      <span
        className={cn(
          "font-semibold tracking-tight",
          size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm",
          isYes ? "text-yes" : "text-no",
        )}
      >
        GG {pick}
      </span>
      <span
        className={cn(
          "num font-medium tabular-nums text-foreground/90",
          size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        {pct(probability)}
      </span>
      <span
        className={cn(
          "hidden items-center gap-1 text-[10px] uppercase tracking-wider sm:inline-flex",
          CONVICTION_STYLE[conviction],
        )}
      >
        <span
          className={cn(
            "h-1 w-1 rounded-full",
            conviction === "HIGH"
              ? "bg-primary"
              : conviction === "MEDIUM"
                ? "bg-amber-300"
                : "bg-muted-foreground",
          )}
        />
        {CONVICTION_LABEL[conviction]}
      </span>
    </div>
  );
}

export { CONVICTION_LABEL, CONVICTION_STYLE };

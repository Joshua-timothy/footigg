import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { MODEL } from "@/lib/constants";
import type { SyncStatus } from "@/types/domain";

export function StatusPanel({ status }: { status: SyncStatus }) {
  const isDemo = status.mode === "demo";
  const stale = status.stale && !isDemo;

  return (
    <div className="space-y-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-60",
              stale ? "bg-amber-400" : "bg-primary",
              !stale && "animate-ping",
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              stale ? "bg-amber-400" : "bg-primary",
            )}
          />
        </span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {isDemo ? "Demo data" : stale ? "Stale data" : "Live · synced"}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Updated {relativeTime(status.lastSuccessAt)}
      </p>
      {!isDemo ? (
        <p className="num text-[10px] text-muted-foreground/60">
          {status.requestsLastMinute}/{status.requestsPerMinuteBudget} API calls · last 60s
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed text-muted-foreground/60">
          Synthetic season, real engine.
        </p>
      )}
      <p className="border-t border-white/[0.05] pt-2 text-[10px] text-muted-foreground/50">
        Model {MODEL.version}
      </p>
    </div>
  );
}

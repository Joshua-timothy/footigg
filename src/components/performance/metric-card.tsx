import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-card/60 p-4">
      <div className="label-caps text-[9px]">{label}</div>
      <div
        className={cn(
          "num mt-1.5 text-2xl font-semibold leading-none tracking-tight",
          tone === "good"
            ? "text-yes"
            : tone === "warn"
              ? "text-amber-300"
              : tone === "bad"
                ? "text-no"
                : "text-foreground",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/65">{hint}</div>
      ) : null}
    </div>
  );
}

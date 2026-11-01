import { pct } from "@/lib/utils";

export function ProbabilitySplit({ yes, no }: { yes: number; no: number }) {
  return (
    <div className="w-full">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full bg-yes/80 transition-[width] duration-500"
          style={{ width: `${yes * 100}%` }}
        />
        <div className="h-full flex-1 bg-no/55" />
      </div>
      <div className="num mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="text-yes/90">YES {pct(yes)}</span>
        <span className="text-no/90">NO {pct(no)}</span>
      </div>
    </div>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={
              index < filled
                ? "h-2.5 w-1 rounded-sm bg-primary/80"
                : "h-2.5 w-1 rounded-sm bg-white/[0.08]"
            }
          />
        ))}
      </div>
      <span className="num text-[10px] text-muted-foreground">{pct(value)}</span>
    </div>
  );
}

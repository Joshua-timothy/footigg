import { pct } from "@/lib/utils";
import type { PickSide } from "@/types/domain";

export function ProbabilityRing({
  value,
  pick,
  size = 136,
  label = "P(GG)",
}: {
  value: number;
  pick: PickSide;
  size?: number;
  label?: string;
}) {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, value)));
  const color = pick === "YES" ? "hsl(var(--yes))" : "hsl(var(--no))";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(0 0% 100% / 0.06)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="num text-2xl font-semibold leading-none tracking-tight">
          {pct(value)}
        </span>
        <span className="label-caps text-[10px]">{label}</span>
      </div>
    </div>
  );
}

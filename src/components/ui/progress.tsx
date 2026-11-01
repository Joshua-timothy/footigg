import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
}

/** Simple, dependency-free progress bar (value 0..1). */
export function Progress({ value, className, indicatorClassName }: ProgressProps) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-500", indicatorClassName)}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

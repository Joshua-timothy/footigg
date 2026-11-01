import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="label-caps">{label}</span>
      <span className="num text-lg font-semibold leading-none tracking-tight">{value}</span>
      {hint ? <span className="text-2xs text-muted-foreground/80">{hint}</span> : null}
    </div>
  );
}

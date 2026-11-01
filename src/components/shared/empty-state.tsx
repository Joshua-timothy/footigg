import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed border-white/10 bg-card/40 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.35]" />
      <div className="relative mx-auto max-w-sm space-y-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

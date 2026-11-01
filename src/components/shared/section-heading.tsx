import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

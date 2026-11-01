import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysKey, toDateKey } from "@/lib/format";
import { boardQuery } from "@/lib/filters";
import { cn } from "@/lib/utils";
import type { BoardFilters } from "@/types/domain";

function weekday(dateKey: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
}

export function DateNav({ filters }: { filters: BoardFilters }) {
  const today = toDateKey();
  const days = Array.from({ length: 7 }, (_, index) => addDaysKey(filters.date, index - 3));

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={boardQuery({ ...filters, date: addDaysKey(filters.date, -1) })}
        aria-label="Previous day"
        className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
        {days.map((day) => {
          const active = day === filters.date;
          const isToday = day === today;
          return (
            <Link
              key={day}
              href={boardQuery({ ...filters, date: day })}
              className={cn(
                "flex min-w-[52px] flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 transition-colors",
                active
                  ? "border-primary/30 bg-primary/[0.09]"
                  : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]",
              )}
            >
              <span
                className={cn(
                  "text-[9px] uppercase tracking-[0.1em]",
                  active ? "text-primary/90" : "text-muted-foreground/60",
                )}
              >
                {weekday(day)}
              </span>
              <span
                className={cn(
                  "num text-sm font-medium leading-none",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {day.slice(8)}
              </span>
              <span
                className={cn(
                  "h-0.5 w-0.5 rounded-full",
                  isToday ? "bg-primary" : "bg-transparent",
                )}
              />
            </Link>
          );
        })}
      </div>

      <Link
        href={boardQuery({ ...filters, date: addDaysKey(filters.date, 1) })}
        aria-label="Next day"
        className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

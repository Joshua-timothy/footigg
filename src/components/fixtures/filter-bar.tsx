"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { COMPETITIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { hasActiveFilters } from "@/lib/filters";
import type { BoardFilters } from "@/types/domain";
import { Input } from "@/components/ui/input";

export function FilterBar({ filters }: { filters: BoardFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query);

  useEffect(() => {
    setQuery(filters.query);
  }, [filters.query]);

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const next = params.toString();
      startTransition(() => {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (query === filters.query) return;
    const timer = setTimeout(() => {
      update((params) => {
        if (query.trim()) params.set("q", query.trim());
        else params.delete("q");
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [query, filters.query, update]);

  const toggleCompetition = (code: string) => {
    update((params) => {
      const current = new Set(
        (params.get("comp") ?? "").split(",").filter(Boolean),
      );
      if (current.has(code)) current.delete(code);
      else current.add(code);
      if (current.size === 0) params.delete("comp");
      else params.set("comp", Array.from(current).join(","));
    });
  };

  const setParam = (key: string, value: string | null) => {
    update((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  };

  const reset = () => {
    setQuery("");
    update((params) => {
      ["comp", "pick", "conviction", "q"].forEach((key) => params.delete(key));
    });
  };

  const active = hasActiveFilters(filters);

  return (
    <div
      className={cn(
        "space-y-2.5 transition-opacity duration-200",
        pending && "pointer-events-none opacity-60",
      )}
    >
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setParam("comp", null)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            filters.competitions.length === 0
              ? "border-white/15 bg-white/[0.07] text-foreground"
              : "border-white/[0.06] text-muted-foreground hover:border-white/[0.12] hover:text-foreground",
          )}
        >
          All leagues
        </button>
        {COMPETITIONS.map((competition) => {
          const selected = filters.competitions.includes(competition.code);
          return (
            <button
              key={competition.code}
              type="button"
              onClick={() => toggleCompetition(competition.code)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                selected
                  ? "border-primary/35 bg-primary/[0.09] text-primary"
                  : "border-white/[0.06] text-muted-foreground hover:border-white/[0.12] hover:text-foreground",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: competition.accent }}
              />
              {competition.shortName}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team or league"
            className="h-8 pl-8 text-xs"
            aria-label="Search fixtures"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
          {(
            [
              ["ALL", "All"],
              ["YES", "GG Yes"],
              ["NO", "GG No"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setParam("pick", value === "ALL" ? null : value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                filters.pick === value
                  ? value === "YES"
                    ? "bg-yes/15 text-yes"
                    : value === "NO"
                      ? "bg-no/15 text-no"
                      : "bg-white/[0.07] text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <select
            value={filters.conviction}
            onChange={(event) =>
              setParam("conviction", event.target.value === "ALL" ? null : event.target.value)
            }
            className="h-8 appearance-none rounded-lg border border-white/[0.06] bg-white/[0.02] pl-2.5 pr-7 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus:border-primary/40"
            aria-label="Conviction filter"
          >
            <option value="ALL">Any conviction</option>
            <option value="HIGH">High only</option>
            <option value="MEDIUM">Medium +</option>
            <option value="LOW">Coin-flips</option>
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/60">
            ▾
          </span>
        </div>

        {active ? (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

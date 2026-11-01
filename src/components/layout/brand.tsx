import Link from "next/link";
import { APP } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="footigg-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(158 70% 58%)" />
          <stop offset="100%" stopColor="hsl(168 65% 38%)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#footigg-mark)" />
      <path
        d="M9.5 21.5c0-6 3.6-10.2 9.2-10.2"
        stroke="hsl(160 45% 7%)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="21.4" cy="20.4" r="3.1" fill="hsl(160 45% 7%)" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <BrandMark className="h-8 w-8 transition-transform duration-300 group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-[0.08em]">{APP.name}</span>
        {!compact ? (
          <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            GG intelligence
          </span>
        ) : null}
      </span>
    </Link>
  );
}

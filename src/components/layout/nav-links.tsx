"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutGrid, Settings2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Board", icon: LayoutGrid, match: (path: string) => path === "/" || path.startsWith("/match") },
  { href: "/competitions", label: "Leagues", icon: Trophy, match: (path: string) => path.startsWith("/competitions") },
  { href: "/performance", label: "Model", icon: Activity, match: (path: string) => path.startsWith("/performance") },
  { href: "/settings", label: "Settings", icon: Settings2, match: (path: string) => path.startsWith("/settings") },
] as const;

export function NavLinks({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const pathname = usePathname() ?? "/";

  if (variant === "mobile") {
    return (
      <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-white/[0.07] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/[0.06] text-foreground"
                : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <item.icon
              className={cn(
                "h-4 w-4 transition-colors",
                active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

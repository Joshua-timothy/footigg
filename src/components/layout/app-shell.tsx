import { APP } from "@/lib/constants";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { StatusPanel } from "@/components/layout/status-panel";
import type { SyncStatus } from "@/types/domain";

export function AppShell({
  children,
  status,
}: {
  children: React.ReactNode;
  status: SyncStatus;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-white/[0.06] bg-black/20 px-4 py-6 lg:flex">
        <Brand />
        <NavLinks />
        <div className="mt-auto space-y-3">
          <StatusPanel status={status} />
          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground/45">
            {APP.tagline}
            <br />
            Free-tier build · no paid services
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/85 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand compact />
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {status.mode === "demo" ? "Demo" : status.stale ? "Stale" : "Live"}
            </span>
          </div>
          <div className="px-3 pb-2">
            <NavLinks variant="mobile" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>

        <footer className="mx-auto w-full max-w-[1180px] px-4 pb-8 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-4 text-[10px] text-muted-foreground/50">
            <span>{APP.name} · both teams to score, explained</span>
            <span>football-data.org free tier · Supabase free tier</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

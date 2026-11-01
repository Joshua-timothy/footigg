import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  LogOut,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SectionHeading } from "@/components/shared/section-heading";
import { MetricCard } from "@/components/performance/metric-card";
import { SyncNowButton } from "@/components/settings/sync-now-button";
import { getStatusData } from "@/lib/data/queries";
import { env, flags, hasAccessCode, hasApiKey, hasDatabase } from "@/lib/env";
import { signOut } from "@/lib/auth/actions";
import { APP, MODEL, SYNC } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };
export const maxDuration = 60;

function ConfigRow({
  label,
  description,
  configured,
  value,
}: {
  label: string;
  description: string;
  configured: boolean;
  value?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.04] py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-foreground/90">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/65">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {value ? (
          <span className="num rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-muted-foreground">
            {value}
          </span>
        ) : null}
        <Badge variant={configured ? "yes" : "muted"}>
          {configured ? "Set" : "Missing"}
        </Badge>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const status = await getStatusData();
  const demo = status.mode === "demo";
  const lastRun = status.lastRun;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Settings
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tightest">System & access</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Everything this app talks to runs on a free tier. This page shows what is wired up,
          how much of the football-data.org budget is in use, and lets you trigger a sync.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Data mode"
          value={demo ? "Demo" : "Live"}
          hint={demo ? "Synthetic season · real engine" : "Supabase + football-data.org"}
          tone={demo ? "warn" : "good"}
        />
        <MetricCard
          label="Last success"
          value={status.lastSuccessAt ? relativeTime(status.lastSuccessAt) : "Never"}
          hint={
            status.lastSuccessAt
              ? formatDateTime(status.lastSuccessAt)
              : "Run a sync to populate data"
          }
          tone={status.stale && !demo ? "warn" : "neutral"}
        />
        <MetricCard
          label="API budget"
          value={`${status.requestsLastMinute}/${status.requestsPerMinuteBudget}`}
          hint="Requests in the last 60 seconds"
          tone={status.requestsLastMinute > 6 ? "warn" : "good"}
        />
        <MetricCard
          label="Database"
          value={status.databaseConfigured ? "Connected" : "Not set"}
          hint={status.databaseConfigured ? "Supabase Postgres" : "Demo repository"}
          tone={status.databaseConfigured ? "good" : "neutral"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Sync</CardTitle>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {status.nextRunHint}
                  </p>
                </div>
                <Badge variant={status.stale && !demo ? "warning" : "yes"}>
                  {demo ? "Demo" : status.stale ? "Stale" : "Fresh"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SyncNowButton disabled={demo} />

              <Separator />

              {lastRun ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium">Last run</span>
                    <Badge
                      variant={
                        lastRun.status === "SUCCESS"
                          ? "yes"
                          : lastRun.status === "FAILED"
                            ? "no"
                            : lastRun.status === "PARTIAL"
                              ? "warning"
                              : "muted"
                      }
                    >
                      {lastRun.status.toLowerCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] sm:grid-cols-3">
                    {[
                      { label: "Trigger", value: lastRun.trigger },
                      { label: "Started", value: formatDateTime(lastRun.startedAt) },
                      {
                        label: "Finished",
                        value: lastRun.finishedAt
                          ? formatDateTime(lastRun.finishedAt)
                          : "—",
                      },
                      { label: "Fixtures seen", value: String(lastRun.matchesSeen) },
                      { label: "Rows changed", value: String(lastRun.matchesSaved) },
                      { label: "Predictions", value: String(lastRun.predictions) },
                      { label: "Resolved", value: String(lastRun.resolved) },
                      { label: "API requests", value: String(lastRun.requests) },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between border-b border-white/[0.04] py-1"
                      >
                        <span className="text-muted-foreground/65">{item.label}</span>
                        <span className="num text-foreground/85">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {lastRun.error ? (
                    <p className="rounded-md border border-no/20 bg-no/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-no/85">
                      {lastRun.error}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground/70">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  No sync has run yet. The daily Vercel cron runs at 05:00 UTC, and the board
                  triggers a lazy sync after {SYNC.minIntervalMinutes} minutes.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <SectionHeading
                title="Configuration"
                description="Secrets are checked for presence only — their values are never rendered."
              />
            </CardHeader>
            <CardContent>
              <ConfigRow
                label="Database"
                description="Supabase pooled Postgres connection used at runtime."
                configured={hasDatabase}
              />
              <ConfigRow
                label="football-data.org key"
                description="Free plan: 10 requests per minute, all ten competitions."
                configured={hasApiKey}
              />
              <ConfigRow
                label="Access gate"
                description="Shared access code plus a signed, http-only session cookie."
                configured={hasAccessCode && Boolean(env.AUTH_SECRET)}
              />
              <ConfigRow
                label="Cron secret"
                description="Bearer token checked by /api/cron/daily."
                configured={Boolean(env.CRON_SECRET)}
              />
              <ConfigRow
                label="Demo mode"
                description="auto falls back to demo when the database or API key is missing."
                configured
                value={env.DEMO_MODE}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Free-tier guardrails</CardTitle>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The app is designed to stay inside these limits forever, not just this month.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: Gauge,
                    title: `${SYNC.safeRequestsPerMinute} of ${SYNC.requestsPerMinute} requests`,
                    body: "The sync service keeps a two-request reserve under the hard free-plan limit.",
                  },
                  {
                    icon: Clock3,
                    title: `Lazy sync every ${SYNC.minIntervalMinutes} min`,
                    body: "Page views only trigger a sync when the last success is old enough. A Postgres row lock prevents overlap.",
                  },
                  {
                    icon: Database,
                    title: `${SYNC.revalidateSeconds}s render cache`,
                    body: "The board is cached with unstable_cache and refreshed by tag after a manual sync.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Daily Vercel cron",
                    body: "Hobby allows one cron per day at 05:00 UTC. Everything else is lazy and budget-checked.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="h-3.5 w-3.5 text-primary/80" />
                      <p className="text-[11px] font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/70">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Gate</span>
                <Badge variant={flags.auth ? "yes" : "muted"}>
                  {flags.auth ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                {flags.auth
                  ? "One shared code for you and a few friends. Sessions are signed with Web Crypto and expire automatically."
                  : "No access code is configured, so anyone with the URL can open the app. Set APP_ACCESS_CODE and AUTH_SECRET before deploying."}
              </p>
              {flags.auth ? (
                <form action={signOut}>
                  <Button type="submit" variant="outline" size="sm" className="w-full gap-2">
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[10px]">
              {[
                { label: "Version", value: MODEL.version },
                { label: "History window", value: `${MODEL.historyDays} days` },
                { label: "Half-life", value: `${MODEL.halfLifeDays} days` },
                { label: "Shrinkage", value: `${MODEL.shrinkageMatches} matches` },
                { label: "Dixon-Coles ρ", value: MODEL.rho.toFixed(2) },
                { label: "Goal grid", value: `0–${MODEL.maxGoals}` },
                { label: "Form weight", value: `${Math.round(MODEL.formWeight * 100)}%` },
                { label: "H2H weight", value: `${Math.round(MODEL.h2hWeight * 100)}%` },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between border-b border-white/[0.04] py-1.5 last:border-0"
                >
                  <span className="text-muted-foreground/70">{item.label}</span>
                  <span className="num text-foreground/85">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[10px] leading-relaxed text-muted-foreground/75">
              <p className="flex items-start gap-1.5">
                {flags.database ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-yes/80" />
                ) : (
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                )}
                Database schema pushed with <span className="num">prisma db push</span>.
              </p>
              <p className="flex items-start gap-1.5">
                {flags.api ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-yes/80" />
                ) : (
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                )}
                football-data.org key configured for live fixtures.
              </p>
              <p className="flex items-start gap-1.5">
                {flags.auth ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-yes/80" />
                ) : (
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                )}
                Access gate enabled for friends and family.
              </p>
              <Separator />
              <p className="text-muted-foreground/55">
                {APP.name} · {APP.timezone} · model {MODEL.version}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

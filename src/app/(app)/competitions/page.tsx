import type { Metadata } from "next";
import { after } from "next/server";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeagueCard } from "@/components/leagues/league-card";
import { LeagueTable } from "@/components/leagues/league-table";
import { SectionHeading } from "@/components/shared/section-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { getLeagueData } from "@/lib/data/queries";
import { isCompetitionCode, type SearchParams } from "@/lib/filters";
import { maybeLazySync } from "@/lib/sync/sync-service";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Leagues" };

// The background sync runs inside this request via after(); give it room on
// Vercel Hobby, whose default function budget is shorter than a full sync.
export const maxDuration = 60;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const overviews = await getLeagueData();

  after(async () => {
    try {
      await maybeLazySync("leagues-view");
    } catch {
      // A background sync failure must never break the page.
    }
  });

  const requested = first(params.league)?.toUpperCase();
  const selected =
    (requested && isCompetitionCode(requested)
      ? overviews.find((overview) => overview.competition.code === requested)
      : undefined) ?? overviews[0];

  if (!selected) {
    return (
      <EmptyState
        title="No competitions loaded"
        description="The competition list is empty. Run a sync or start the app in demo mode."
      />
    );
  }

  const { competition, baseline, teams, upcoming, finished } = selected;

  const baselineItems = [
    { label: "Home goals / game", value: baseline.avgHomeGoals.toFixed(2) },
    { label: "Away goals / game", value: baseline.avgAwayGoals.toFixed(2) },
    { label: "Total goals / game", value: baseline.avgTotalGoals.toFixed(2) },
    { label: "GG base rate", value: pct(baseline.bttsRate) },
    { label: "Home win", value: pct(baseline.homeWinRate) },
    { label: "Away win", value: pct(baseline.awayWinRate) },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Competitions
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tightest">League context</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tables, scoring baselines and both-teams-to-score rates for every tracked
            competition. These are the priors the model starts from.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Trophy className="h-3 w-3" />
          {overviews.length} competitions
        </Badge>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {overviews.map((overview) => (
          <LeagueCard
            key={overview.competition.code}
            overview={overview}
            selected={overview.competition.code === competition.code}
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ backgroundColor: competition.accent }}
                />
                <div>
                  <CardTitle className="text-base">{competition.name}</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {competition.country}
                    {competition.season ? ` · ${competition.season}/${String(competition.season + 1).slice(2)} season` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="muted">{finished} played</Badge>
                <Badge variant="outline">{upcoming} upcoming</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <LeagueTable teams={teams} />
          </CardContent>
        </Card>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Scoring baseline</CardTitle>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Recency-weighted over the last 420 days. The model blends this with team
                ratings and shrinks small samples toward it.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.04]">
                {baselineItems.map((item) => (
                  <div key={item.label} className="bg-[hsl(155_10%_6.5%)] px-3 py-2.5">
                    <p className="label-caps text-[8px]">{item.label}</p>
                    <p className="num mt-1 text-sm font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5 text-[10px] leading-relaxed text-muted-foreground/70">
                <p>
                  {baseline.matches} finished matches inform this baseline. Draws run at{" "}
                  {pct(baseline.drawRate)}.
                </p>
                {baseline.priorDominated ? (
                  <p className="text-amber-300/75">
                    Early-season sample: a long-run prior carries most of the weight until
                    enough games are played.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Reading the table</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[10px] leading-relaxed text-muted-foreground/75">
              <p>
                <span className="text-foreground/85">GG</span> is the share of that team&apos;s
                league games where both sides scored. It is descriptive, not a prediction.
              </p>
              <p>
                <span className="text-foreground/85">Avg</span> is total goals per game across
                both ends. High-scoring teams are not automatically good GG picks — the model
                cares about both attacks and both defences.
              </p>
              <p>
                Form dots are the five most recent league results, newest first. Green = win,
                grey = draw, red = loss.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Champions League</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] leading-relaxed text-muted-foreground/75">
                Continental fixtures do not have a domestic table here. The model fits a joint
                rating pool across each side&apos;s dominant league plus Champions League
                matches, and flags the extra variance on the match page.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <SectionHeading
        title="Why this matters"
        description="Every prediction on the board is built from these numbers. If a league has a high GG base rate, the model still has to find two attacks and two defences that support it."
      />
    </div>
  );
}

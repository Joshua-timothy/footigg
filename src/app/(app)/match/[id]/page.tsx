import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Flame,
  Info,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SectionHeading } from "@/components/shared/section-heading";
import { TeamCrest } from "@/components/shared/team-crest";
import { FormDots } from "@/components/shared/form-dots";
import { ProbabilityRing } from "@/components/prediction/probability-ring";
import { ProbabilitySplit } from "@/components/prediction/probability-split";
import { VerdictBadge, CONVICTION_LABEL } from "@/components/prediction/verdict-badge";
import { FactorList } from "@/components/prediction/factor-list";
import { ScoreHeatmap } from "@/components/prediction/score-heatmap";
import { MarketGrid } from "@/components/prediction/market-grid";
import { getMatchData } from "@/lib/data/queries";
import { buildScoreMatrix, topScorelines } from "@/lib/prediction";
import { formatDateTime, formatKickoffWithDay, relativeTime } from "@/lib/format";
import { cn, pct } from "@/lib/utils";
import type {
  Coverage,
  FormMatch,
  HeadToHead,
  MatchRecord,
  Prediction,
  TeamForm,
  TeamRef,
} from "@/types/domain";

export const metadata: Metadata = { title: "Match detail" };

const COVERAGE_VARIANT: Record<Coverage, "yes" | "warning" | "no"> = {
  HIGH: "yes",
  MEDIUM: "warning",
  LOW: "no",
};

function statusLabel(status: MatchRecord["status"]): string {
  switch (status) {
    case "IN_PLAY":
      return "In play";
    case "PAUSED":
      return "Half time";
    case "FINISHED":
      return "Full time";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    case "SUSPENDED":
      return "Suspended";
    case "AWARDED":
      return "Awarded";
    case "TIMED":
    case "SCHEDULED":
      return "Scheduled";
    default:
      return status;
  }
}

function TeamBlock({ team, side }: { team: TeamRef; side: "home" | "away" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:text-left",
        side === "away" && "sm:flex-row-reverse sm:text-right",
      )}
    >
      <TeamCrest team={team} size="xl" className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
          {side === "home" ? "Home" : "Away"}
        </p>
        <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight sm:text-xl">
          {team.shortName}
        </h2>
        <p className="truncate text-[11px] text-muted-foreground/70">{team.name}</p>
      </div>
    </div>
  );
}

function ResultBanner({
  match,
  prediction,
  correct,
}: {
  match: MatchRecord;
  prediction: Prediction | null;
  correct: boolean | null;
}) {
  const finished = match.status === "FINISHED" && match.score.home !== null;
  const live = match.status === "IN_PLAY" || match.status === "PAUSED";

  if (finished) {
    const actual = match.btts;
    const hit = correct ?? (prediction && actual !== null ? prediction.pick === (actual ? "YES" : "NO") : null);
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3.5 py-2.5 text-xs",
          hit === true
            ? "border-yes/25 bg-yes/[0.07] text-yes"
            : hit === false
              ? "border-no/25 bg-no/[0.07] text-no"
              : "border-white/[0.07] bg-white/[0.02] text-muted-foreground",
        )}
      >
        {hit === true ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : hit === false ? (
          <XCircle className="h-4 w-4 shrink-0" />
        ) : (
          <Info className="h-4 w-4 shrink-0" />
        )}
        <span className="font-medium">
          {hit === true ? "Pick landed" : hit === false ? "Pick missed" : "Result recorded"}
        </span>
        <span className="num text-foreground/85">
          {match.score.home}–{match.score.away}
        </span>
        <span className="text-muted-foreground">
          {actual === null ? "GG unknown" : actual ? "Both teams scored" : "At least one clean sheet"}
        </span>
        {prediction ? (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Pick was GG {prediction.pick} · {pct(prediction.probabilityYes)}
          </span>
        ) : (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/60">
            No pre-match pick stored
          </span>
        )}
      </div>
    );
  }

  if (live) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5 text-xs text-amber-200/90">
        <Flame className="h-4 w-4 shrink-0" />
        <span className="font-medium">In play</span>
        <span className="text-amber-200/70">
          The pick below was frozen before kick-off and is not updated live.
        </span>
      </div>
    );
  }

  if (["POSTPONED", "CANCELLED", "SUSPENDED"].includes(match.status)) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-xs text-muted-foreground">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        Fixture {statusLabel(match.status).toLowerCase()} — the pre-match pick is kept for the record.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-xs text-muted-foreground">
      <Clock3 className="h-4 w-4 shrink-0" />
      <span>Kick-off {formatKickoffWithDay(match.kickoff)}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/60">
        {prediction?.pick ? `GG ${prediction.pick}` : "Prediction pending"}
      </span>
    </div>
  );
}

function FormRow({ match }: { match: FormMatch }) {
  const resultStyle =
    match.result === "W"
      ? "text-yes"
      : match.result === "L"
        ? "text-no"
        : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[11px]">
      <span className="num w-9 shrink-0 text-muted-foreground/60">{match.venue}</span>
      <span className="min-w-0 flex-1 truncate text-foreground/85">{match.opponent}</span>
      <span className="num w-10 text-right font-medium">
        {match.goalsFor}–{match.goalsAgainst}
      </span>
      <span className={cn("num w-3 text-right text-[10px] font-semibold", resultStyle)}>
        {match.result}
      </span>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          match.btts ? "bg-yes/80" : "bg-white/15",
        )}
        title={match.btts ? "Both teams scored" : "Not both teams scored"}
      />
    </div>
  );
}

function TeamFormPanel({ form, side }: { form: TeamForm; side: "home" | "away" }) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2">
        <span className="truncate text-xs font-medium">{form.teamName}</span>
        <Badge variant="muted" className="shrink-0">
          {side}
        </Badge>
        <span className="ml-auto shrink-0">
          <FormDots results={form.streak} />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.04]">
        {[
          { label: "GG rate", value: pct(form.bttsRate) },
          { label: "Scored", value: form.avgGoalsFor.toFixed(2) },
          { label: "Conceded", value: form.avgGoalsAgainst.toFixed(2) },
        ].map((item) => (
          <div key={item.label} className="bg-[hsl(155_10%_6.5%)] px-2.5 py-2">
            <p className="label-caps text-[8px]">{item.label}</p>
            <p className="num mt-0.5 text-sm font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-4 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between border-b border-white/[0.05] py-1">
          <span>Home GG</span>
          <span className="num text-foreground/80">{pct(form.home.bttsRate)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-white/[0.05] py-1">
          <span>Away GG</span>
          <span className="num text-foreground/80">{pct(form.away.bttsRate)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span>Clean sheets</span>
          <span className="num text-foreground/80">{form.cleanSheets}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span>Failed to score</span>
          <span className="num text-foreground/80">{form.failedToScore}</span>
        </div>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {form.recent.slice(0, 6).map((match) => (
          <FormRow key={match.matchId} match={match} />
        ))}
        {form.recent.length === 0 ? (
          <p className="py-2 text-[11px] text-muted-foreground/70">
            No recent matches in the data window.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function H2HPanel({ h2h }: { h2h: HeadToHead }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.04]">
        {[
          { label: "Meetings", value: String(h2h.matches) },
          { label: "GG rate", value: h2h.bttsRate === null ? "—" : pct(h2h.bttsRate) },
          {
            label: "Avg goals",
            value: h2h.avgTotalGoals === null ? "—" : h2h.avgTotalGoals.toFixed(2),
          },
        ].map((item) => (
          <div key={item.label} className="bg-[hsl(155_10%_6.5%)] px-2.5 py-2">
            <p className="label-caps text-[8px]">{item.label}</p>
            <p className="num mt-0.5 text-sm font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-white/[0.04]">
        {h2h.recent.map((match) => (
          <Link
            key={match.id}
            href={`/match/${match.id}`}
            className="flex items-center gap-2 py-2 text-[11px] transition-colors hover:text-foreground"
          >
            <span className="num w-14 shrink-0 text-muted-foreground/60">
              {formatDateTime(match.kickoff).split(",")[0]}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground/85">
              {match.homeTeam.shortName} v {match.awayTeam.shortName}
            </span>
            <span className="num font-medium">
              {match.score.home}–{match.score.away}
            </span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                match.btts ? "bg-yes/80" : "bg-white/15",
              )}
            />
          </Link>
        ))}
        {h2h.recent.length === 0 ? (
          <p className="py-2 text-[11px] text-muted-foreground/70">
            No previous meetings in the data window.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RatingBar({
  label,
  value,
  reliability,
  hint,
}: {
  label: string;
  value: number;
  reliability: number;
  hint: string;
}) {
  const width = Math.min(100, Math.max(4, (value / 2) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="num text-xs font-medium text-foreground/90">{value.toFixed(2)}×</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-[9px] text-muted-foreground/55">
        {hint} · {pct(reliability)} reliable
      </p>
    </div>
  );
}

function DataQualityPanel({ prediction }: { prediction: Prediction }) {
  const { quality } = prediction;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Coverage</span>
        <Badge variant={COVERAGE_VARIANT[quality.coverage]}>{quality.coverage}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 text-[10px]">
        {[
          { label: "Team sample", value: `${quality.homeSample} / ${quality.awaySample}` },
          { label: "League games", value: String(quality.leagueSample) },
          { label: "Model sample", value: String(quality.matchesUsed) },
          { label: "Confidence", value: pct(prediction.confidence) },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between border-b border-white/[0.05] py-1.5">
            <span className="text-muted-foreground/70">{item.label}</span>
            <span className="num text-foreground/85">{item.value}</span>
          </div>
        ))}
      </div>
      <ul className="space-y-1.5">
        {quality.notes.map((note) => (
          <li key={note} className="flex gap-1.5 text-[10px] leading-relaxed text-muted-foreground/75">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-white/25" />
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  const detail = await getMatchData(matchId);
  if (!detail) notFound();

  const { match, prediction, competition, h2h, resolved, persisted } = detail;
  const finished = match.status === "FINISHED" && match.score.home !== null;
  const live = match.status === "IN_PLAY" || match.status === "PAUSED";

  const grid = prediction
    ? buildScoreMatrix(
        prediction.expectedGoals.home,
        prediction.expectedGoals.away,
        prediction.explanation.rho,
        8,
      )
    : null;
  const top = grid ? topScorelines(grid, 6) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to board
        </Link>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: competition.accent }}
          />
          <span className="uppercase tracking-[0.16em]">{competition.shortName}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="num">{formatKickoffWithDay(match.kickoff)}</span>
        </div>
      </div>

      <Card className="panel-sheen">
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={finished ? "muted" : live ? "warning" : "outline"}>
                {live ? (
                  <span className="h-1 w-1 animate-pulse rounded-full bg-amber-300" />
                ) : null}
                {statusLabel(match.status)}
              </Badge>
              {match.matchday ? (
                <Badge variant="outline">Matchday {match.matchday}</Badge>
              ) : null}
              {match.stage ? <Badge variant="outline">{match.stage}</Badge> : null}
              {persisted ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <ShieldCheck className="h-3 w-3 text-primary/80" />
                  Frozen pick
                </span>
              ) : prediction ? (
                <span className="text-[10px] text-muted-foreground/60">Live preview</span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <TeamBlock team={match.homeTeam} side="home" />

              <div className="flex flex-col items-center justify-center gap-1">
                {finished ? (
                  <>
                    <span className="num text-4xl font-semibold tracking-tightest">
                      {match.score.home}–{match.score.away}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
                      Full time
                    </span>
                  </>
                ) : (
                  <>
                    <span className="num text-2xl font-medium tracking-tight text-muted-foreground/70">
                      v
                    </span>
                    <span className="num text-[10px] text-muted-foreground/60">
                      {formatDateTime(match.kickoff)}
                    </span>
                  </>
                )}
              </div>

              <TeamBlock team={match.awayTeam} side="away" />
            </div>

            {prediction ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
                <VerdictBadge
                  pick={prediction.pick}
                  probability={prediction.probabilityYes}
                  conviction={prediction.conviction}
                  size="md"
                />
                <div className="min-w-[140px] flex-1">
                  <ProbabilitySplit
                    yes={prediction.probabilityYes}
                    no={prediction.probabilityNo}
                  />
                </div>
                <span className="num text-[10px] text-muted-foreground/70">
                  {CONVICTION_LABEL[prediction.conviction]} · confidence{" "}
                  {pct(prediction.confidence)}
                </span>
              </div>
            ) : null}

            <ResultBanner match={match} prediction={prediction} correct={resolved.correct} />
          </div>

          {prediction ? (
            <div className="flex flex-col items-center gap-4 border-t border-white/[0.06] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <ProbabilityRing
                value={prediction.probabilityYes}
                pick={prediction.pick}
                size={148}
              />
              <div className="grid w-full grid-cols-3 gap-2 text-center">
                {[
                  { label: "xG home", value: prediction.expectedGoals.home.toFixed(2) },
                  { label: "xG away", value: prediction.expectedGoals.away.toFixed(2) },
                  { label: "xG total", value: prediction.expectedGoals.total.toFixed(2) },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border border-white/[0.05] bg-white/[0.02] px-1.5 py-1.5">
                    <p className="label-caps text-[7px]">{item.label}</p>
                    <p className="num mt-0.5 text-xs font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-[9px] leading-relaxed text-muted-foreground/55">
                Generated {relativeTime(prediction.generatedAt)} · model{" "}
                {prediction.modelVersion}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {prediction ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <SectionHeading
                    title="Why this pick"
                    description="Each input is switched off in turn. The swing in P(GG) is its impact — the full working, no black box."
                  />
                </CardHeader>
                <CardContent>
                  <FactorList factors={prediction.factors} />
                  <Separator className="my-4" />
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: "Grid model",
                        value: pct(prediction.explanation.modelProbability),
                        hint: `weight ${pct(prediction.explanation.weights.model)}`,
                      },
                      {
                        label: "Recent GG form",
                        value:
                          prediction.explanation.formProbability === null
                            ? "—"
                            : pct(prediction.explanation.formProbability),
                        hint: `weight ${pct(prediction.explanation.weights.form)}`,
                      },
                      {
                        label: "Head-to-head",
                        value:
                          prediction.explanation.h2hProbability === null
                            ? "—"
                            : pct(prediction.explanation.h2hProbability),
                        hint: `weight ${pct(prediction.explanation.weights.h2h)}`,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                        <p className="label-caps text-[8px]">{item.label}</p>
                        <p className="num mt-1 text-sm font-semibold">{item.value}</p>
                        <p className="mt-0.5 text-[9px] text-muted-foreground/60">{item.hint}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 xl:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Scoreline matrix</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Dixon-Coles adjusted grid · P(home goals × away goals)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ScoreHeatmap grid={grid ?? []} maxGoals={6} topScorelines={top} />
                    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/60">
                      Cells show the percentage chance of each exact score. The green outline
                      marks the most likely scorelines. Low-score cells are lifted by the
                      Dixon-Coles correction (ρ {prediction.explanation.rho.toFixed(2)}).
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Derived markets</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      All prices are fair odds (1 ÷ probability) from the same grid.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <MarketGrid markets={prediction.markets} />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <SectionHeading
                    title="Recent form"
                    description="Ten most recent matches per side, with the both-teams-to-score record highlighted."
                  />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-white/[0.05]">
                    <div className="sm:pr-5">
                      <TeamFormPanel form={prediction.form.home} side="home" />
                    </div>
                    <div className="sm:pl-5">
                      <TeamFormPanel form={prediction.form.away} side="away" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Info className="h-6 w-6 text-muted-foreground/60" />
                <div>
                  <p className="text-sm font-medium">No pre-match pick recorded</p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    This fixture kicked off before a prediction was stored, so the app will not
                    invent one after the fact. That keeps the accuracy record honest.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Head to head</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Previous meetings inside the 420-day history window.
              </p>
            </CardHeader>
            <CardContent>
              <H2HPanel h2h={h2h} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          {prediction ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Data quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataQualityPanel prediction={prediction} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Fitted ratings</CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Multiplicative strength · 1.00 = league average
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RatingBar
                    label={`${match.homeTeam.shortName} attack`}
                    value={prediction.ratings.home.attack}
                    reliability={prediction.ratings.home.reliability}
                    hint={`${prediction.ratings.home.matches} matches`}
                  />
                  <RatingBar
                    label={`${match.homeTeam.shortName} defence`}
                    value={prediction.ratings.home.defence}
                    reliability={prediction.ratings.home.reliability}
                    hint={`${prediction.ratings.home.matches} matches`}
                  />
                  <Separator />
                  <RatingBar
                    label={`${match.awayTeam.shortName} attack`}
                    value={prediction.ratings.away.attack}
                    reliability={prediction.ratings.away.reliability}
                    hint={`${prediction.ratings.away.matches} matches`}
                  />
                  <RatingBar
                    label={`${match.awayTeam.shortName} defence`}
                    value={prediction.ratings.away.defence}
                    reliability={prediction.ratings.away.reliability}
                    hint={`${prediction.ratings.away.matches} matches`}
                  />
                  <p className="text-[9px] leading-relaxed text-muted-foreground/55">
                    Defence above 1.00 leaks more than average. Small samples are shrunk toward
                    the league mean, so early-season ratings move slowly.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>League baseline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-[11px]">
                  {[
                    { label: "Home goals / game", value: prediction.baseline.avgHomeGoals.toFixed(2) },
                    { label: "Away goals / game", value: prediction.baseline.avgAwayGoals.toFixed(2) },
                    { label: "GG base rate", value: pct(prediction.baseline.bttsRate) },
                    { label: "Finished games", value: String(prediction.baseline.matches) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 last:border-0">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="num font-medium text-foreground/85">{item.value}</span>
                    </div>
                  ))}
                  {prediction.baseline.priorDominated ? (
                    <p className="pt-1 text-[9px] leading-relaxed text-amber-300/70">
                      Early-season sample: the long-run prior carries most of the weight.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Data quality</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  No prediction payload is available for this fixture. Head-to-head history is
                  still shown on the left.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Model notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[10px] leading-relaxed text-muted-foreground/75">
              <p>
                Predictions are frozen before kick-off and stored with their inputs. The board
                and this page always show the original pick, even after the result.
              </p>
              <p>
                Form and head-to-head panels are rebuilt from matches before the kick-off cutoff,
                so no post-match information leaks into the explanation.
              </p>
              <p className="text-muted-foreground/55">
                Probabilistic output, not betting advice. High conviction still loses.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

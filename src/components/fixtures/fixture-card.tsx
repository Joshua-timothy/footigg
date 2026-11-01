import Link from "next/link";
import { cn, pct } from "@/lib/utils";
import { formatKickoff } from "@/lib/format";
import type { FixturePrediction, TeamForm, TeamRef } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { BttsDots } from "@/components/shared/form-dots";
import { TeamCrest } from "@/components/shared/team-crest";
import { ProbabilitySplit } from "@/components/prediction/probability-split";
import { VerdictBadge, CONVICTION_LABEL } from "@/components/prediction/verdict-badge";

function TeamRow({
  team,
  form,
  goals,
  finished,
}: {
  team: TeamRef;
  form?: TeamForm;
  goals: number | null;
  finished: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamCrest team={team} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-tight">
        {team.shortName}
      </span>
      {form ? <BttsDots matches={form.recent} /> : null}
      <span className="num w-10 text-right text-[10px] text-muted-foreground">
        {finished ? "" : form ? pct(form.bttsRate) : "—"}
      </span>
      {finished ? (
        <span className="num w-4 text-right text-sm font-semibold">{goals ?? "–"}</span>
      ) : null}
    </div>
  );
}

export function FixtureCard({ fixture }: { fixture: FixturePrediction }) {
  const { match, prediction, competition } = fixture;
  const finished = match.status === "FINISHED" && match.score.home !== null;
  const live = match.status === "IN_PLAY" || match.status === "PAUSED";
  const unavailable = ["POSTPONED", "CANCELLED", "SUSPENDED"].includes(match.status);
  const hit = finished && prediction ? (prediction.pick === "YES") === match.btts : null;

  return (
    <Link
      href={`/match/${match.id}`}
      className="group relative block overflow-hidden rounded-xl border border-white/[0.06] bg-card/70 p-4 transition-all duration-200 hover:border-white/[0.13] hover:bg-card"
      aria-label={`${match.homeTeam.name} vs ${match.awayTeam.name} prediction`}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${competition.accent}, transparent)`,
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: competition.accent }}
          />
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {competition.shortName}
          </span>
        </div>

        {finished ? (
          <Badge variant="muted" className="num shrink-0">
            FT {match.score.home}–{match.score.away}
          </Badge>
        ) : live ? (
          <Badge variant="warning" className="shrink-0">
            <span className="h-1 w-1 animate-pulse rounded-full bg-amber-300" />
            Live
          </Badge>
        ) : unavailable ? (
          <Badge variant="outline" className="shrink-0 capitalize">
            {match.status.toLowerCase()}
          </Badge>
        ) : (
          <span className="num shrink-0 text-[11px] text-muted-foreground">
            {formatKickoff(match.kickoff)}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <TeamRow
          team={match.homeTeam}
          form={prediction?.form.home}
          goals={match.score.home}
          finished={finished}
        />
        <TeamRow
          team={match.awayTeam}
          form={prediction?.form.away}
          goals={match.score.away}
          finished={finished}
        />
      </div>

      <div className="mt-3.5 flex items-center gap-3 rounded-lg border border-white/[0.05] bg-black/25 px-2.5 py-2">
        {prediction ? (
          <>
            <VerdictBadge
              pick={prediction.pick}
              probability={prediction.probabilityYes}
              conviction={prediction.conviction}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <ProbabilitySplit
                yes={prediction.probabilityYes}
                no={prediction.probabilityNo}
              />
            </div>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {finished ? "No pre-match pick recorded" : "Prediction pending"}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/80">
        {prediction ? (
          <>
            <span className="num">
              xG {prediction.expectedGoals.total.toFixed(2)} ·{" "}
              <span
                className={cn(
                  prediction.conviction === "HIGH"
                    ? "text-primary/90"
                    : prediction.conviction === "MEDIUM"
                      ? "text-amber-300/80"
                      : "text-muted-foreground/70",
                )}
              >
                {CONVICTION_LABEL[prediction.conviction]}
              </span>
            </span>
            {hit !== null ? (
              <span className={cn("font-medium", hit ? "text-yes" : "text-no")}>
                {hit ? "GG hit" : "GG missed"}
              </span>
            ) : (
              <span className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Why this pick →
              </span>
            )}
          </>
        ) : (
          <span className="num">xG unavailable</span>
        )}
      </div>
    </Link>
  );
}

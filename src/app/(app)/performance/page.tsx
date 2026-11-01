import type { Metadata } from "next";
import { Activity, Info, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelDialog } from "@/components/shared/model-dialog";
import { SectionHeading } from "@/components/shared/section-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { CalibrationChart } from "@/components/performance/calibration-chart";
import { MetricCard } from "@/components/performance/metric-card";
import { AccuracyTable } from "@/components/performance/accuracy-table";
import { ResolvedList } from "@/components/performance/resolved-list";
import { CONVICTION_LABEL } from "@/components/prediction/verdict-badge";
import { getPerformanceData } from "@/lib/data/queries";
import { relativeTime } from "@/lib/format";
import { cn, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Model performance" };

export default async function PerformancePage() {
  const report = await getPerformanceData();

  const accuracyTone =
    report.accuracy >= 0.55 ? "good" : report.accuracy < 0.45 ? "bad" : "neutral";
  const brierTone = report.brier <= 0.24 ? "good" : report.brier >= 0.26 ? "bad" : "neutral";
  const logLossTone =
    report.logLoss <= 0.67 ? "good" : report.logLoss >= 0.7 ? "bad" : "neutral";
  const eceTone =
    report.calibrationError <= 0.05
      ? "good"
      : report.calibrationError >= 0.1
        ? "bad"
        : "warn";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Model performance
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tightest">
            The honest scoreboard
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every pick is frozen before kick-off and scored after full time. No edits, no
            hindsight — just calibration and accuracy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Activity className="h-3 w-3" />
            {report.modelVersion}
          </Badge>
          <ModelDialog />
        </div>
      </header>

      {!report.hasSignal ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />
          <div className="text-[11px] leading-relaxed text-amber-200/80">
            <span className="font-medium text-amber-200">Small sample.</span> Only{" "}
            {report.totalResolved} resolved pick{report.totalResolved === 1 ? "" : "s"} so far.
            The metrics below are real but noisy until at least 10 results are in. Treat them
            as a calibration check, not a verdict.
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Accuracy"
          value={report.totalResolved > 0 ? pct(report.accuracy) : "—"}
          hint={`${report.hits} of ${report.totalResolved} picks`}
          tone={accuracyTone}
        />
        <MetricCard
          label="Brier score"
          value={report.totalResolved > 0 ? report.brier.toFixed(3) : "—"}
          hint="Lower is better · coin-flip 0.250"
          tone={brierTone}
        />
        <MetricCard
          label="Log loss"
          value={report.totalResolved > 0 ? report.logLoss.toFixed(3) : "—"}
          hint="Lower is better · coin-flip 0.693"
          tone={logLossTone}
        />
        <MetricCard
          label="Calibration"
          value={report.totalResolved > 0 ? pct(report.calibrationError, 1) : "—"}
          hint="Expected calibration error"
          tone={eceTone}
        />
        <MetricCard
          label="Avg P(GG)"
          value={report.totalResolved > 0 ? pct(report.avgProbabilityYes) : "—"}
          hint={`Actual GG rate ${report.totalResolved > 0 ? pct(report.actualBttsRate) : "—"}`}
        />
        <MetricCard
          label="Resolved"
          value={String(report.totalResolved)}
          hint={report.since ? `Since ${relativeTime(report.since)}` : "No results yet"}
        />
      </div>

      {report.totalResolved === 0 ? (
        <EmptyState
          title="No scored picks yet"
          description="Once fixtures finish, their frozen pre-match picks are resolved here. In live mode this needs a sync after full time; the demo season already contains results."
        />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader className="pb-3">
                <SectionHeading
                  title="Calibration"
                  description="When the model says 60%, do 60% of those matches actually see both teams score? Points on the dashed line are perfectly calibrated."
                />
              </CardHeader>
              <CardContent>
                <CalibrationChart
                  buckets={report.calibration}
                  calibrationError={report.calibrationError}
                />
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>By conviction</CardTitle>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Conviction measures distance from a coin flip, gated by data reliability.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.byConviction.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No resolved picks yet.</p>
                  ) : (
                    report.byConviction.map((entry) => (
                      <div key={entry.conviction} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-[11px] font-medium",
                              entry.conviction === "HIGH"
                                ? "text-primary"
                                : entry.conviction === "MEDIUM"
                                  ? "text-amber-300"
                                  : "text-muted-foreground",
                            )}
                          >
                            {CONVICTION_LABEL[entry.conviction]}
                          </span>
                          <span className="num text-[10px] text-muted-foreground/70">
                            {entry.hits}/{entry.resolved} · {pct(entry.accuracy)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              entry.conviction === "HIGH"
                                ? "bg-primary/70"
                                : entry.conviction === "MEDIUM"
                                  ? "bg-amber-300/60"
                                  : "bg-white/25",
                            )}
                            style={{ width: `${Math.max(3, entry.accuracy * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                  <p className="border-t border-white/[0.05] pt-2 text-[9px] leading-relaxed text-muted-foreground/55">
                    High conviction should beat low conviction over time. If it does not, the
                    model is overconfident and the thresholds need revisiting.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Reading the scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-[10px] leading-relaxed text-muted-foreground/75">
                  <p>
                    <span className="text-foreground/85">Accuracy</span> is the share of picks
                    whose side of 50% was right. It ignores how confident the model was.
                  </p>
                  <p>
                    <span className="text-foreground/85">Brier</span> and{" "}
                    <span className="text-foreground/85">log loss</span> reward honest
                    probabilities. A model that is right but overconfident still scores badly.
                  </p>
                  <p>
                    <span className="text-foreground/85">Calibration</span> compares predicted
                    probability with observed frequency across ten buckets.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <SectionHeading
                  title="By competition"
                  description="Where the model has an edge and where the league is simply hard to call."
                />
              </CardHeader>
              <CardContent>
                <AccuracyTable leagues={report.byLeague} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <SectionHeading
                    title="Recent results"
                    description="The latest frozen picks, scored against the final score."
                  />
                  <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </div>
              </CardHeader>
              <CardContent>
                <ResolvedList rows={report.recent.slice(0, 10)} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

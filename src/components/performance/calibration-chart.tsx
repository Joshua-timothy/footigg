import { pct } from "@/lib/utils";
import type { CalibrationBucket } from "@/types/domain";

const WIDTH = 320;
const HEIGHT = 220;
const PAD = 30;
const PLOT_W = WIDTH - PAD * 2;
const PLOT_H = HEIGHT - PAD * 2;

function x(predicted: number): number {
  return PAD + predicted * PLOT_W;
}

function y(actual: number): number {
  return PAD + (1 - actual) * PLOT_H;
}

export function CalibrationChart({
  buckets,
  calibrationError,
}: {
  buckets: CalibrationBucket[];
  calibrationError: number;
}) {
  const points = buckets.filter((bucket) => bucket.count > 0);
  const polyline = points.map((bucket) => `${x(bucket.predicted)},${y(bucket.actual)}`).join(" ");
  const gridValues = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-white/30" />
            Perfect calibration
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Observed
          </span>
        </div>
        <span className="num text-[10px] text-muted-foreground">
          ECE {pct(calibrationError, 1)}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/[0.05] bg-black/25 p-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label="Calibration chart: predicted probability versus observed both-teams-to-score rate"
        >
          <defs>
            <linearGradient id="calibration-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={x(value)}
                y1={PAD}
                x2={x(value)}
                y2={PAD + PLOT_H}
                stroke="hsl(0 0% 100% / 0.05)"
                strokeWidth="1"
              />
              <line
                x1={PAD}
                y1={y(value)}
                x2={PAD + PLOT_W}
                y2={y(value)}
                stroke="hsl(0 0% 100% / 0.05)"
                strokeWidth="1"
              />
              <text
                x={x(value)}
                y={HEIGHT - 10}
                textAnchor="middle"
                fontSize="8"
                fill="hsl(150 5% 55%)"
              >
                {Math.round(value * 100)}%
              </text>
              <text
                x={PAD - 6}
                y={y(value) + 2.5}
                textAnchor="end"
                fontSize="8"
                fill="hsl(150 5% 55%)"
              >
                {Math.round(value * 100)}%
              </text>
            </g>
          ))}

          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(1)}
            y2={y(1)}
            stroke="hsl(0 0% 100% / 0.28)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {points.length > 1 ? (
            <polygon
              points={`${x(points[0].predicted)},${PAD + PLOT_H} ${polyline} ${x(
                points[points.length - 1].predicted,
              )},${PAD + PLOT_H}`}
              fill="url(#calibration-fill)"
            />
          ) : null}

          {points.length > 1 ? (
            <polyline
              points={polyline}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {points.map((bucket) => (
            <g key={bucket.label}>
              <circle
                cx={x(bucket.predicted)}
                cy={y(bucket.actual)}
                r={Math.min(6, 2.5 + Math.sqrt(bucket.count) * 0.7)}
                fill="hsl(var(--primary))"
                fillOpacity="0.9"
                stroke="hsl(155 12% 4%)"
                strokeWidth="1.5"
              >
                <title>
                  {`${bucket.label} · predicted ${pct(bucket.predicted, 1)} · observed ${pct(
                    bucket.actual,
                    1,
                  )} · ${bucket.count} picks`}
                </title>
              </circle>
            </g>
          ))}

          <text
            x={PAD + PLOT_W / 2}
            y={HEIGHT - 1}
            textAnchor="middle"
            fontSize="8"
            fill="hsl(150 5% 45%)"
          >
            Predicted P(GG)
          </text>
          <text
            x={9}
            y={PAD + PLOT_H / 2}
            textAnchor="middle"
            fontSize="8"
            fill="hsl(150 5% 45%)"
            transform={`rotate(-90 9 ${PAD + PLOT_H / 2})`}
          >
            Observed GG rate
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5"
          >
            <p className="num text-[9px] text-muted-foreground/60">{bucket.label}</p>
            <p className="num mt-0.5 text-[10px] font-medium">
              {bucket.count === 0 ? "—" : pct(bucket.actual, 0)}
            </p>
            <p className="text-[8px] text-muted-foreground/45">
              {bucket.count === 0 ? "no picks" : `${bucket.count} picks`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

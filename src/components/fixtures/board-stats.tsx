import { pct } from "@/lib/utils";
import type { BoardStats as BoardStatsType } from "@/types/domain";

export function BoardStats({
  stats,
  totalOnDate,
}: {
  stats: BoardStatsType;
  totalOnDate: number;
}) {
  const items = [
    { label: "Fixtures", value: String(stats.fixtures), hint: `${totalOnDate} on this date` },
    {
      label: "GG Yes",
      value: String(stats.yesPicks),
      hint: stats.fixtures > 0 ? pct(stats.yesPicks / Math.max(stats.fixtures, 1)) : "—",
    },
    {
      label: "GG No",
      value: String(stats.noPicks),
      hint: stats.fixtures > 0 ? pct(stats.noPicks / Math.max(stats.fixtures, 1)) : "—",
    },
    {
      label: "Avg P(GG)",
      value: stats.fixtures > 0 ? pct(stats.avgProbabilityYes) : "—",
      hint: "blended model",
    },
    {
      label: "Avg xG",
      value: stats.fixtures > 0 ? stats.avgExpectedGoals.toFixed(2) : "—",
      hint: `${stats.highConviction} high conviction`,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-card/60">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
      <div className="relative grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="bg-[hsl(155_10%_6.5%)] p-4">
            <div className="label-caps text-[9px]">{item.label}</div>
            <div className="num mt-1.5 text-xl font-semibold leading-none tracking-tight">
              {item.value}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground/70">{item.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { pct } from "@/lib/utils";
import type { MarketProbabilities } from "@/types/domain";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="num text-[11px] font-medium text-foreground/90">{value}</span>
    </div>
  );
}

export function MarketGrid({ markets }: { markets: MarketProbabilities }) {
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      <div className="divide-y divide-white/[0.04]">
        <Row label="Both teams score" value={pct(markets.bttsYes)} />
        <Row label="Home win" value={pct(markets.homeWin)} />
        <Row label="Draw" value={pct(markets.draw)} />
        <Row label="Away win" value={pct(markets.awayWin)} />
      </div>
      <div className="divide-y divide-white/[0.04]">
        <Row label="Over 1.5 goals" value={pct(markets.over15)} />
        <Row label="Over 2.5 goals" value={pct(markets.over25)} />
        <Row label="Over 3.5 goals" value={pct(markets.over35)} />
        <Row label="0–0" value={pct(markets.nilNil, 1)} />
      </div>
      <div className="col-span-full mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-yes/20 bg-yes/[0.06] px-3 py-2">
          <div className="label-caps text-[9px] text-yes/70">Fair odds · YES</div>
          <div className="num mt-0.5 text-sm font-semibold text-yes">
            {markets.fairOddsYes.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-no/20 bg-no/[0.06] px-3 py-2">
          <div className="label-caps text-[9px] text-no/70">Fair odds · NO</div>
          <div className="num mt-0.5 text-sm font-semibold text-no">
            {markets.fairOddsNo.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

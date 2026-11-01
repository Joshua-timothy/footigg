import { COMPETITIONS } from "@/lib/constants";
import type { CompetitionCode, FixturePrediction } from "@/types/domain";
import { FixtureCard } from "@/components/fixtures/fixture-card";

export function FixtureBoard({ fixtures }: { fixtures: FixturePrediction[] }) {
  const groups = new Map<CompetitionCode, FixturePrediction[]>();
  for (const fixture of fixtures) {
    const bucket = groups.get(fixture.match.competitionCode);
    if (bucket) bucket.push(fixture);
    else groups.set(fixture.match.competitionCode, [fixture]);
  }

  const ordered = COMPETITIONS.filter((competition) => groups.has(competition.code));

  return (
    <div className="space-y-9">
      {ordered.map((competition) => {
        const items = groups.get(competition.code) ?? [];
        return (
          <section key={competition.code} className="animate-fade-up space-y-3">
            <div className="flex items-center gap-3">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: competition.accent }}
              />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {competition.shortName}
              </h2>
              <span className="num text-[10px] text-muted-foreground/50">{items.length}</span>
              <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {items.map((fixture) => (
                <FixtureCard key={fixture.match.id} fixture={fixture} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

import { FormDots } from "@/components/shared/form-dots";
import { TeamCrest } from "@/components/shared/team-crest";
import { cn, pct } from "@/lib/utils";
import type { TeamLeagueStat } from "@/types/domain";

function goalsDifference(team: TeamLeagueStat): number {
  return team.goalsFor - team.goalsAgainst;
}

export function LeagueTable({ teams }: { teams: TeamLeagueStat[] }) {
  if (teams.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        No finished matches in this competition yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/[0.07] text-left">
            <th className="w-8 pb-2 pl-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              #
            </th>
            <th className="pb-2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Team
            </th>
            {["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((label) => (
              <th
                key={label}
                className="w-9 pb-2 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60"
              >
                {label}
              </th>
            ))}
            <th className="w-14 pb-2 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              GG
            </th>
            <th className="w-12 pb-2 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Avg
            </th>
            <th className="w-24 pb-2 pr-1 text-right text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Form
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {teams.map((team, index) => {
            const points = team.wins * 3 + team.draws;
            const gd = goalsDifference(team);
            return (
              <tr key={team.team.id} className="group transition-colors hover:bg-white/[0.02]">
                <td className="num py-2 pl-1 text-[10px] text-muted-foreground/60">
                  {index + 1}
                </td>
                <td className="py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamCrest team={team.team} size="xs" />
                    <span className="truncate text-[12px] font-medium tracking-tight">
                      {team.team.shortName}
                    </span>
                  </div>
                </td>
                <td className="num py-2 text-right text-muted-foreground">{team.played}</td>
                <td className="num py-2 text-right text-muted-foreground">{team.wins}</td>
                <td className="num py-2 text-right text-muted-foreground">{team.draws}</td>
                <td className="num py-2 text-right text-muted-foreground">{team.losses}</td>
                <td className="num py-2 text-right text-muted-foreground">{team.goalsFor}</td>
                <td className="num py-2 text-right text-muted-foreground">{team.goalsAgainst}</td>
                <td
                  className={cn(
                    "num py-2 text-right",
                    gd > 0 ? "text-yes/85" : gd < 0 ? "text-no/85" : "text-muted-foreground",
                  )}
                >
                  {gd > 0 ? `+${gd}` : gd}
                </td>
                <td className="num py-2 text-right font-semibold">{points}</td>
                <td className="num py-2 text-right">
                  <span
                    className={cn(
                      team.bttsRate >= 0.55
                        ? "text-yes/90"
                        : team.bttsRate <= 0.4
                          ? "text-no/80"
                          : "text-foreground/80",
                    )}
                  >
                    {pct(team.bttsRate)}
                  </span>
                </td>
                <td className="num py-2 text-right text-muted-foreground">
                  {team.avgTotalGoals.toFixed(2)}
                </td>
                <td className="py-2 pr-1">
                  <div className="flex justify-end">
                    <FormDots results={team.form} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

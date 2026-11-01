import Image from "next/image";
import { cn, hashString, initials } from "@/lib/utils";
import type { TeamRef } from "@/types/domain";

const SIZES = {
  xs: 20,
  sm: 26,
  md: 34,
  lg: 52,
  xl: 72,
} as const;

export function TeamCrest({
  team,
  size = "sm",
  className,
}: {
  team: TeamRef;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const pixels = SIZES[size];
  const hue = hashString(team.name) % 360;

  if (team.crest) {
    return (
      <Image
        src={team.crest}
        alt=""
        width={pixels}
        height={pixels}
        unoptimized
        className={cn("shrink-0 object-contain", className)}
        style={{ width: pixels, height: pixels }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-white/10 font-semibold text-white/85",
        className,
      )}
      style={{
        width: pixels,
        height: pixels,
        fontSize: Math.max(9, pixels * 0.32),
        background: `linear-gradient(145deg, hsl(${hue} 42% 30%), hsl(${(hue + 40) % 360} 38% 18%))`,
      }}
    >
      {initials(team.shortName) || team.tla}
    </span>
  );
}

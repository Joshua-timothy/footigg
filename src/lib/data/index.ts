import { flags } from "@/lib/env";
import type { FootballRepository } from "@/lib/data/repository";
import { DemoRepository } from "@/lib/data/demo-repository";
import { PrismaRepository } from "@/lib/data/prisma-repository";

let cached: FootballRepository | null = null;

/**
 * Repository selection. `DEMO_MODE=auto` (the default) falls back to the demo
 * dataset whenever the database or API key is missing, so a fresh clone runs
 * with `npm run dev` and nothing else.
 */
export function getRepository(): FootballRepository {
  if (cached) return cached;
  cached = flags.demo ? new DemoRepository() : new PrismaRepository();
  return cached;
}

export function resetRepository(): void {
  cached = null;
}

export { DemoRepository, PrismaRepository };
export type { FootballRepository };

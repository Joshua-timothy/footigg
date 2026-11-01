import "./load-env";

/**
 * Backfill / repair run.
 *
 * The normal sync already requests a 420-day window, which is the useful
 * maximum on the free plan. This script additionally clears expired sync locks,
 * then reports the resulting table counts so a fresh Supabase project can be
 * verified end to end.
 */
async function main() {
  const { backfillSeasonHistory } = await import("../src/lib/sync/sync-service");
  const { prisma } = await import("../src/lib/db/prisma");

  const staleLocks = await prisma.syncLock.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (staleLocks.count > 0) {
    console.log(`Cleared ${staleLocks.count} expired sync lock(s).`);
  }

  const result = await backfillSeasonHistory({ trigger: "backfill" });

  const [matches, predictions, resolved, competitions, teams] = await Promise.all([
    prisma.match.count(),
    prisma.prediction.count(),
    prisma.prediction.count({ where: { resolvedAt: { not: null } } }),
    prisma.competition.count(),
    prisma.team.count(),
  ]);

  console.log("\nBackfill result");
  console.log(`  status:       ${result.status}${result.reason ? ` (${result.reason})` : ""}`);
  console.log(`  fixtures:     ${result.matchesSeen} seen, ${result.matchesSaved} changed`);
  console.log(`  predictions:  ${result.predictions} stored, ${result.resolved} resolved now`);
  console.log(`  requests:     ${result.requests}`);
  console.log("\nDatabase totals");
  console.log(`  competitions: ${competitions}`);
  console.log(`  teams:        ${teams}`);
  console.log(`  matches:      ${matches}`);
  console.log(`  predictions:  ${predictions} (${resolved} resolved)`);

  await prisma.$disconnect();
  process.exit(result.status === "FAILED" ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

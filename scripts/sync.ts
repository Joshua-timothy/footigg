import "./load-env";

async function main() {
  const { runSync } = await import("../src/lib/sync/sync-service");
  const { prisma } = await import("../src/lib/db/prisma");

  const result = await runSync({ trigger: "cli" });

  const label =
    result.status === "SUCCESS"
      ? "Sync complete"
      : result.status === "SKIPPED"
        ? "Sync skipped"
        : result.status === "FAILED"
          ? "Sync failed"
          : "Sync partially complete";

  console.log(`\n${label}`);
  console.log(`  run:          ${result.runId ?? "—"}`);
  console.log(`  fixtures:     ${result.matchesSeen} seen, ${result.matchesSaved} changed`);
  console.log(`  predictions:  ${result.predictions} stored`);
  console.log(`  resolved:     ${result.resolved}`);
  console.log(`  API requests: ${result.requests}`);
  if (result.reason) console.log(`  reason:       ${result.reason}`);

  await prisma.$disconnect();
  process.exit(result.status === "FAILED" ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

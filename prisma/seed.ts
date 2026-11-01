import "../scripts/load-env";

/**
 * Seeds the ten tracked competitions. Matches, teams and predictions are
 * populated by the sync job (`npm run sync`), so this stays tiny and safe to
 * re-run.
 */
async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { COMPETITIONS } = await import("../src/lib/constants");

  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(
      COMPETITIONS.map((competition, index) =>
        prisma.competition.upsert({
          where: { code: competition.code },
          update: {
            name: competition.name,
            shortName: competition.shortName,
            country: competition.country,
            emblem: competition.emblem,
            sortOrder: index,
            isTracked: true,
          },
          create: {
            code: competition.code,
            name: competition.name,
            shortName: competition.shortName,
            country: competition.country,
            emblem: competition.emblem,
            sortOrder: index,
            isTracked: true,
          },
        }),
      ),
    );

    console.log(`Seeded ${COMPETITIONS.length} competitions.`);
    console.log("Next: npm run sync");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

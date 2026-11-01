import { PrismaClient } from "@prisma/client";

/**
 * Supabase's transaction pooler multiplexes queries, so a small client-side
 * pool (connection_limit=3 in DATABASE_URL) is enough. More than one connection
 * matters here: a background sync can overlap a page render, and a single-slot
 * pool makes one wait for the other until the pool timeout.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

import { PrismaClient } from "@prisma/client";

/**
 * Supabase's transaction pooler (port 6543) hands each query to whichever
 * backend connection happens to be free. A named prepared statement created on
 * one connection can therefore be missing on the next, and Postgres answers
 * `prepared statement "s2" does not exist`. Prisma disables prepared
 * statements when the URL carries `pgbouncer=true`, but that flag is easy to
 * lose when the connection string is copied from the Supabase dashboard.
 *
 * Add it here (plus a small client-side pool) for pooler URLs so the app is
 * correct even if the dashboard value is bare. Supabase's transaction pooler
 * multiplexes queries, so `connection_limit=3` is enough; more than one
 * connection matters because a background sync can overlap a page render.
 */
function withPoolerParams(url: string | undefined): string | undefined {
  if (!url || !/pooler\.supabase\.com:6543/.test(url)) return url;

  const params: string[] = [];
  if (!/[?&]pgbouncer=/.test(url)) params.push("pgbouncer=true");
  if (!/[?&]connection_limit=/.test(url)) params.push("connection_limit=3");
  if (!/[?&]pool_timeout=/.test(url)) params.push("pool_timeout=20");
  if (params.length === 0) return url;

  return `${url}${url.includes("?") ? "&" : "?"}${params.join("&")}`;
}

const databaseUrl = withPoolerParams(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

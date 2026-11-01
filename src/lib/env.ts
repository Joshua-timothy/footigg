import { z } from "zod";

/**
 * Environment handling.
 *
 * The app is designed to boot with zero configuration: if the database or the
 * football-data.org key is missing, it falls back to the deterministic demo
 * dataset. Nothing else in the codebase reads `process.env` directly.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  FOOTBALL_DATA_API_KEY: z.string().min(1).optional(),
  APP_ACCESS_CODE: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  DEMO_MODE: z.enum(["auto", "on", "off"]).default("auto"),
  SYNC_MIN_INTERVAL_MINUTES: z.coerce.number().min(5).max(1440).default(30),
  SYNC_STALE_AFTER_MINUTES: z.coerce.number().min(10).max(1440).default(90),
  BOARD_REVALIDATE_SECONDS: z.coerce.number().min(60).max(86_400).default(900),
  NEXT_PUBLIC_TIMEZONE: z.string().min(1).default("Europe/London"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Never crash the build on an optional variable — surface a readable warning.
  console.warn("[env] Invalid environment configuration", parsed.error.flatten().fieldErrors);
}

export const env = parsed.success
  ? parsed.data
  : schema.parse({
      NODE_ENV: "development",
      DEMO_MODE: "auto",
      SYNC_MIN_INTERVAL_MINUTES: 30,
      SYNC_STALE_AFTER_MINUTES: 90,
      BOARD_REVALIDATE_SECONDS: 900,
      NEXT_PUBLIC_TIMEZONE: "Europe/London",
      LOG_LEVEL: "info",
    });

export const hasDatabase = Boolean(env.DATABASE_URL);
export const hasApiKey = Boolean(env.FOOTBALL_DATA_API_KEY);
export const hasAccessCode = Boolean(env.APP_ACCESS_CODE);

/**
 * demo when forced, or when a required dependency is missing.
 * Production with both a database and an API key runs live.
 */
export const isDemoMode =
  env.DEMO_MODE === "on" || (env.DEMO_MODE === "auto" && (!hasDatabase || !hasApiKey));

export const isAuthEnabled = hasAccessCode && Boolean(env.AUTH_SECRET);

export const flags = {
  demo: isDemoMode,
  database: hasDatabase && !isDemoMode,
  api: hasApiKey,
  auth: isAuthEnabled,
} as const;

if (env.NODE_ENV === "production" && isAuthEnabled === false && hasAccessCode) {
  console.warn("[env] APP_ACCESS_CODE is set but AUTH_SECRET is missing — the gate is disabled.");
}

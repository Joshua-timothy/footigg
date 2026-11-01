import { existsSync } from "node:fs";

/**
 * Loads local env files for CLI scripts. `process.loadEnvFile` is available on
 * Node 20.12+, and existing environment variables always win.
 */
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  try {
    process.loadEnvFile?.(file);
  } catch (error) {
    console.warn(`[env] Could not load ${file}:`, error instanceof Error ? error.message : error);
  }
}

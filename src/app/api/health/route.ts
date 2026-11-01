import { NextResponse } from "next/server";
import { APP, MODEL, SYNC } from "@/lib/constants";
import { flags } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Public liveness probe. Deliberately exposes no secrets or fixture data, so it
 * is safe to leave outside the access gate.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      app: APP.name,
      model: MODEL.version,
      mode: flags.demo ? "demo" : "live",
      checks: {
        database: flags.database,
        footballData: flags.api,
        accessGate: flags.auth,
      },
      budget: {
        requestsPerMinute: SYNC.requestsPerMinute,
        safeRequestsPerMinute: SYNC.safeRequestsPerMinute,
      },
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { env } from "@/lib/env";
import { timingSafeEqual } from "@/lib/auth/token";
import { runSync } from "@/lib/sync/sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return true;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const query = request.nextUrl.searchParams.get("secret") ?? "";

  return (
    (bearer.length > 0 && timingSafeEqual(bearer, env.CRON_SECRET)) ||
    (query.length > 0 && timingSafeEqual(query, env.CRON_SECRET))
  );
}

/** Vercel Hobby daily cron: one sync at 05:00 UTC. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSync({ trigger: "cron" });
  if (result.status === "SUCCESS" || result.status === "PARTIAL") {
    revalidateTag("board");
  }

  return NextResponse.json(
    {
      status: result.status,
      reason: result.reason ?? null,
      runId: result.runId,
      matchesSeen: result.matchesSeen,
      matchesSaved: result.matchesSaved,
      predictions: result.predictions,
      resolved: result.resolved,
      requests: result.requests,
      timestamp: new Date().toISOString(),
    },
    {
      status: result.status === "FAILED" ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

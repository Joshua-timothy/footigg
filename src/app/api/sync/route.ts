import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAuthenticated } from "@/lib/auth/session";
import { runSync } from "@/lib/sync/sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual sync endpoint for the settings page and power users. */
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSync({ trigger: "manual" });
  if (result.status === "SUCCESS" || result.status === "PARTIAL") {
    revalidateTag("board");
  }

  return NextResponse.json(result, {
    status: result.status === "FAILED" ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

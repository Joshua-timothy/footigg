"use server";

import { revalidateTag } from "next/cache";
import { isAuthenticated } from "@/lib/auth/session";
import { runSync, type SyncResult } from "@/lib/sync/sync-service";

export interface SyncActionState {
  ok: boolean;
  message: string;
  result?: SyncResult;
}

const EMPTY: SyncActionState = { ok: true, message: "" };

export async function syncNow(
  _previous: SyncActionState = EMPTY,
  _formData?: FormData,
): Promise<SyncActionState> {
  if (!(await isAuthenticated())) {
    return { ok: false, message: "Your session expired. Reload and sign in again." };
  }

  const result = await runSync({ trigger: "manual" });

  if (result.status === "SUCCESS" || result.status === "PARTIAL") {
    // Refresh the cached board immediately after a manual sync.
    revalidateTag("board");
    return {
      ok: true,
      message:
        result.matchesSaved > 0
          ? `Synced ${result.matchesSeen} fixtures, saved ${result.matchesSaved} changes and stored ${result.predictions} new predictions.`
          : `Checked ${result.matchesSeen} fixtures — everything was already up to date.`,
      result,
    };
  }

  return {
    ok: result.status !== "FAILED",
    message:
      result.reason ??
      (result.status === "FAILED"
        ? "The sync failed. Check the server logs and the API key."
        : "Nothing to sync right now."),
    result,
  };
}

"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncNow, type SyncActionState } from "@/app/(app)/settings/actions";

const INITIAL: SyncActionState = { ok: true, message: "" };

export function SyncNowButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(syncNow, INITIAL);

  return (
    <div className="space-y-2.5">
      <form action={action}>
        <Button type="submit" size="sm" disabled={disabled || pending} className="gap-2">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {pending ? "Syncing…" : "Sync now"}
        </Button>
      </form>

      {state.message ? (
        <p
          className={cn(
            "flex items-start gap-1.5 text-[10px] leading-relaxed",
            state.ok ? "text-yes/85" : "text-no/85",
          )}
          role="status"
        >
          {state.ok ? (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
          )}
          {state.message}
        </p>
      ) : disabled ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground/60">
          Manual sync is disabled in demo mode. Add a database and API key to run it for real.
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed text-muted-foreground/60">
          Fetches four short match windows, stores new predictions and resolves
          finished picks. Uses up to five API requests.
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[footigg] render error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Something broke</p>
        <h1 className="text-xl font-semibold tracking-tight">The board could not load</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Usually this means the database is unreachable or the sync has not run yet. Try again, or
          check Settings for the current data status.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">
          Try again
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href="/settings">Open settings</a>
        </Button>
      </div>
    </div>
  );
}

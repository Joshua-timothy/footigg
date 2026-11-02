"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Route-level boundary for a single fixture. Keeping this scoped to
 * /match/[id] means one bad fixture shows a retry card instead of replacing
 * the whole board with the global error screen.
 */
export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[footigg] match render error", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Match unavailable
        </p>
        <h1 className="text-xl font-semibold tracking-tight">This fixture could not load</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          The rest of the board is fine — only this page failed. Try again, or go back and pick
          another fixture.
        </p>
        {error.digest ? (
          <p className="num text-[10px] text-muted-foreground/50">Reference {error.digest}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">
          Try again
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to board</Link>
        </Button>
      </div>
    </div>
  );
}

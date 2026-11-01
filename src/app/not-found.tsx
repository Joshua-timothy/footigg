import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-30" />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <Brand />
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">404</p>
          <h1 className="text-xl font-semibold tracking-tight">Fixture not found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            This match is not in the tracked window, or it was removed during a sync.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to the board</Link>
        </Button>
      </div>
    </div>
  );
}

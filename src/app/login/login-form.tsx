"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type LoginState } from "@/lib/auth/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [visible, setVisible] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <Label htmlFor="code">Access code</Label>
        <div className="relative">
          <Input
            id="code"
            name="code"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            required
            placeholder="••••••••"
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "code-error" : undefined}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label={visible ? "Hide access code" : "Show access code"}
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {state.error ? (
        <p
          id="code-error"
          role="alert"
          className="rounded-md border border-no/20 bg-no/[0.06] px-2.5 py-2 text-[11px] text-no/90"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking…
          </>
        ) : (
          <>
            Open the board
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

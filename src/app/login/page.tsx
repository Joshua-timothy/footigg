import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { BrandMark } from "@/components/layout/brand";
import { LoginForm } from "@/app/login/login-form";
import { isAuthenticated } from "@/lib/auth/session";
import { APP } from "@/lib/constants";
import { isAuthEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await isAuthenticated()) redirect("/");

  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="h-11 w-11" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{APP.name}</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {APP.tagline}
          </p>
        </div>

        <div className="panel panel-sheen p-6">
          <div className="mb-5 flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08]">
              <LockKeyhole className="h-4 w-4 text-primary" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Private board</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Enter the shared access code to open the GG board.
              </p>
            </div>
          </div>

          <LoginForm next={next} />

          <p className="mt-5 border-t border-white/[0.05] pt-4 text-center text-[10px] leading-relaxed text-muted-foreground/55">
            {isAuthEnabled
              ? "One code for you and a few friends. The session lasts 30 days."
              : "Access gate is not configured on this deployment."}
          </p>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground/40">
          Free-tier build · no paid APIs · predictions are not betting advice
        </p>
      </div>
    </main>
  );
}

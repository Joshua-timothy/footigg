"use server";

import { redirect } from "next/navigation";
import { env, isAuthEnabled } from "@/lib/env";
import { createSession, destroySession } from "@/lib/auth/session";
import { timingSafeEqual } from "@/lib/auth/token";

export interface LoginState {
  error?: string;
}

function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? "/"));

  if (!isAuthEnabled) redirect(next);

  if (!code || !env.APP_ACCESS_CODE || !timingSafeEqual(code, env.APP_ACCESS_CODE)) {
    // Slow down brute-force attempts without adding infrastructure.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { error: "That access code doesn't match." };
  }

  await createSession();
  redirect(next);
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

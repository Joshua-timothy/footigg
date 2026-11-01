import { cookies } from "next/headers";
import { APP } from "@/lib/constants";
import { env, isAuthEnabled } from "@/lib/env";
import { SESSION_TTL_MS, createSessionToken, verifySessionToken } from "@/lib/auth/token";

export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthEnabled) return true;
  const store = await cookies();
  const token = store.get(APP.sessionCookie)?.value;
  if (!token) return false;
  return verifySessionToken(token, env.AUTH_SECRET as string);
}

export async function createSession(): Promise<void> {
  if (!isAuthEnabled) return;
  const token = await createSessionToken(env.AUTH_SECRET as string);
  const store = await cookies();
  store.set(APP.sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(APP.sessionCookie);
}

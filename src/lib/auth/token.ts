/**
 * Edge-safe session token helpers (Web Crypto only).
 *
 * Format: `v1.<expiresAtMs>.<hmacSHA256>` where the HMAC covers `v1.<expiresAtMs>`.
 * No third-party auth service is required, which keeps the app free forever.
 */

const encoder = new TextEncoder();

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Constant-time string comparison for secrets and signatures. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const payload = `v1.${now + SESSION_TTL_MS}`;
  return `${payload}.${await sign(secret, payload)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresRaw, signature] = parts;
  if (version !== "v1") return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= now) return false;

  const expected = await sign(secret, `${version}.${expiresRaw}`);
  return timingSafeEqual(expected, signature);
}

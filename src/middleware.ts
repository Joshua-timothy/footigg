import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/token";

const SESSION_COOKIE = "footigg_session";

const PUBLIC_PATHS = ["/login", "/api/health", "/api/cron"];

/**
 * Access gate for one owner + a few friends. Disabled entirely when
 * APP_ACCESS_CODE or AUTH_SECRET is not set (handy for local development).
 */
export async function middleware(request: NextRequest) {
  const accessCode = process.env.APP_ACCESS_CODE;
  const secret = process.env.AUTH_SECRET;
  if (!accessCode || !secret) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token, secret) : false;
  if (valid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

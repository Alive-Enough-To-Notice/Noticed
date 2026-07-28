import { NextRequest, NextResponse } from "next/server";
import {
  OWNER_SESSION_COOKIE,
  ownerGateEnabled,
  verifyOwnerSessionToken,
} from "@/lib/owner-auth";

/**
 * Next.js 16 proxy (formerly middleware). Gates the Studio UI when
 * NOTICED_OWNER_PASSWORD is set. MCP OAuth + /api/mcp use bearer tokens.
 */
export function proxy(request: NextRequest) {
  if (!ownerGateEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === "/api/mcp" ||
    pathname.startsWith("/api/mcp/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/mcp/oauth/") ||
    pathname === "/login" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/feed.xml"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(OWNER_SESSION_COOKIE)?.value;
  if (verifyOwnerSessionToken(token)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

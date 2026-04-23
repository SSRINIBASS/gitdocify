/**
 * Gitdocify — Next.js Edge Middleware
 *
 * Handles JWT authentication for API routes and rate limiting.
 * Runs on the Edge runtime for <200ms response times.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/register",
];

// Routes that are always accessible (static files, pages)
const ALWAYS_ALLOWED = [
  "/",
  "/settings",
  "/repo",
  "/_next",
  "/favicon.ico",
];

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow non-API routes and public API routes
  if (
    ALWAYS_ALLOWED.some((p) => pathname.startsWith(p) && !pathname.startsWith("/api")) ||
    PUBLIC_ROUTES.includes(pathname)
  ) {
    return NextResponse.next();
  }

  // Only protect API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Extract token
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Check cookie if no header
  const cookieToken = request.cookies.get("token")?.value;
  const finalToken = token || cookieToken;

  if (!finalToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(finalToken, getJwtSecret());

    // Add user info to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-email", payload.email as string);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};

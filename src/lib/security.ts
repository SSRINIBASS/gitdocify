/**
 * Gitdocify — Security Middleware
 *
 * Security utilities and middleware for the application.
 */

import { NextResponse } from "next/server";
import { apiRateLimiter } from "@/lib/rateLimit";
import { logSecurityEvent, SecurityEvents } from "@/lib/securityAudit";

export interface SecurityConfig {
  // Rate limiting configuration
  rateLimit?: {
    windowMs: number;  // Time window in milliseconds
    maxRequests: number;  // Maximum requests per window
  };

  // Content Security Policy
  csp?: string;

  // Additional security headers
  extraHeaders?: Record<string, string>;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  },
  csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
  extraHeaders: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  }
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-Content-Security", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  return response;
}

/**
 * Security middleware for API routes
 */
export async function securityMiddleware(
  request: Request,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<NextResponse | null> {
  // Apply rate limiting if configured
  if (config.rateLimit) {
    const clientIP = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateLimitResult = apiRateLimiter.isAllowed(`api:${clientIP}`);

    if (!rateLimitResult.allowed) {
      // Log rate limit exceeded event
      await logSecurityEvent({
        ipAddress: clientIP,
        action: SecurityEvents.RATE_LIMIT_EXCEEDED,
        status: "blocked",
        timestamp: new Date(),
        userAgent: request.headers.get("user-agent") || "unknown",
      });

      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later."
        },
        { status: 429 }
      );
    }
  }

  return null;
}
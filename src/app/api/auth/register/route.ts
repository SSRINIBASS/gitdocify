/**
 * POST /api/auth/register — Create a new user account.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, signToken, validatePassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { authRateLimiter } from "@/lib/rateLimit";
import { logAuthenticationEvent, SecurityEvents } from "@/lib/securityAudit";

export async function POST(request: Request) {
  try {
    // Rate limiting check
    const clientIP = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateLimitResult = authRateLimiter.isAllowed(`register:${clientIP}`);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later."
        },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      // Log failed registration attempt
      await logAuthenticationEvent(request, null, SecurityEvents.REGISTRATION_ATTEMPT, false);

      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      // Log failed registration attempt
      await logAuthenticationEvent(request, null, SecurityEvents.REGISTRATION_ATTEMPT, false);

      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existing.length > 0) {
      // Log failed registration attempt
      await logAuthenticationEvent(request, null, SecurityEvents.REGISTRATION_ATTEMPT, false);

      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
      })
      .returning({ id: users.id, email: users.email });

    // Generate token
    const token = await signToken({ userId: user.id, email: user.email });

    // Log successful registration
    await logAuthenticationEvent(request, user.id, SecurityEvents.REGISTRATION_SUCCESS, true);
    await logAuthenticationEvent(request, user.id, SecurityEvents.LOGIN_SUCCESS, true);

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        token,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error (full):", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
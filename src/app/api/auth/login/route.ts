/**
 * POST /api/auth/login — Authenticate user and return JWT.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { comparePassword, signToken, validatePassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { authRateLimiter } from "@/lib/rateLimit";
import { logAuthenticationEvent, SecurityEvents, extractClientInfo } from "@/lib/securityAudit";

export async function POST(request: Request) {
  try {
    // Rate limiting check
    const clientIP = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateLimitResult = authRateLimiter.isAllowed(`login:${clientIP}`);

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
      // Log failed login attempt
      await logAuthenticationEvent(request, null, SecurityEvents.LOGIN_ATTEMPT, false);

      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      // Log failed login attempt
      await logAuthenticationEvent(request, null, SecurityEvents.LOGIN_ATTEMPT, false);

      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      // Log failed login attempt
      await logAuthenticationEvent(request, null, SecurityEvents.LOGIN_FAILURE, false);

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      // Log failed login attempt
      await logAuthenticationEvent(request, null, SecurityEvents.LOGIN_FAILURE, false);

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Log successful login
    await logAuthenticationEvent(request, user.id, SecurityEvents.LOGIN_SUCCESS, true);

    // Generate token
    const token = await signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        hasApiKey: !!user.encryptedGeminiKey,
      },
      token,
    });

    // Set HTTP-only cookie with enhanced security attributes
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: "lax",
      maxAge: 86400, // 24 hours
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error (full):", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

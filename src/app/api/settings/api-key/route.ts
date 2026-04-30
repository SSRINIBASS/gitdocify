/**
 * /api/settings/api-key
 * POST — Store encrypted Gemini API key
 * GET  — Check if key is configured (returns masked status)
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { encrypt, maskApiKey, decrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";
import { securityMiddleware } from "@/lib/security";
import { logSecurityEvent, SecurityEvents } from "@/lib/securityAudit";

export async function POST(request: Request) {
  try {
    // Apply security middleware
    const securityResponse = await securityMiddleware(request);
    if (securityResponse) {
      return securityResponse;
    }

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      return NextResponse.json(
        { error: "Valid API key is required" },
        { status: 400 }
      );
    }

    // Verify user still exists in DB
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, auth.userId));

    if (!user) {
      return NextResponse.json(
        { error: "User session is invalid. Please log out and log in again." },
        { status: 401 }
      );
    }

    // Encrypt and store
    const encryptedKey = encrypt(apiKey);
    await db
      .update(users)
      .set({ encryptedGeminiKey: encryptedKey })
      .where(eq(users.id, auth.userId));

    // Log API key update
    await logSecurityEvent({
      userId: auth.userId,
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      action: SecurityEvents.API_KEY_UPDATE,
      status: "success",
      timestamp: new Date(),
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      message: "API key saved successfully",
      maskedKey: maskApiKey(apiKey),
    });
  } catch (error) {
    console.error("API key save error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Apply security middleware
    const securityResponse = await securityMiddleware(request);
    if (securityResponse) {
      return securityResponse;
    }

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db
      .select({ encryptedGeminiKey: users.encryptedGeminiKey })
      .from(users)
      .where(eq(users.id, auth.userId));

    if (!user?.encryptedGeminiKey) {
      return NextResponse.json({ configured: false });
    }

    // Decrypt just to show masked version
    try {
      const key = decrypt(user.encryptedGeminiKey);

      // Log API key access
      await logSecurityEvent({
        userId: auth.userId,
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
        action: SecurityEvents.API_KEY_ACCESS,
        status: "success",
        timestamp: new Date(),
        userAgent: request.headers.get("user-agent") || "unknown",
      });

      return NextResponse.json({
        configured: true,
        maskedKey: maskApiKey(key),
      });
    } catch {
      return NextResponse.json({ configured: false });
    }
  } catch (error) {
    console.error("API key check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

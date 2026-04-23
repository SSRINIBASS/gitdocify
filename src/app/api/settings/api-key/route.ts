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

export async function POST(request: Request) {
  try {
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

    // Encrypt and store
    const encryptedKey = encrypt(apiKey);
    await db
      .update(users)
      .set({ encryptedGeminiKey: encryptedKey })
      .where(eq(users.id, auth.userId));

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

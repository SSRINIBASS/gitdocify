/**
 * GET /api/intelligence/[id]/analysis — Get code analysis results
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Repository ID is required" }, { status: 400 });
    }

    // Verify repo access
    const [repo] = await db
      .select()
      .from(repositories)
      .where(
        and(eq(repositories.id, id), eq(repositories.userId, auth.userId))
      );

    if (!repo) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Return real analysis data if available, otherwise return null
    if (repo.codeAnalysisJson) {
      try {
        const analysis = JSON.parse(repo.codeAnalysisJson);
        return NextResponse.json({ analysis });
      } catch {
        return NextResponse.json({ analysis: null });
      }
    }

    return NextResponse.json({ analysis: null });
  } catch (error) {
    console.error("❌ Code Analysis API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
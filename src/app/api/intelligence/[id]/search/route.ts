/**
 * GET /api/intelligence/[id]/search — Semantic code search via pgvector.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { repositories, users } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { generateEmbedding } from "@/lib/gemini";
import { decrypt } from "@/lib/crypto";
import { searchSimilar } from "@/lib/vector-search";

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
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
    const threshold = parseFloat(searchParams.get("threshold") || "0.5");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    // Verify repo access and status
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

    const indexedStates = ["INDEXED", "DOCS_GENERATED", "READY"];
    if (!indexedStates.includes(repo.status)) {
      return NextResponse.json(
        { error: `Repository must be indexed first. Current status: ${repo.status}` },
        { status: 400 }
      );
    }

    // Get user's API key
    const [user] = await db
      .select({ encryptedGeminiKey: users.encryptedGeminiKey })
      .from(users)
      .where(eq(users.id, auth.userId));

    if (!user?.encryptedGeminiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 400 }
      );
    }

    const apiKey = decrypt(user.encryptedGeminiKey);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, apiKey);

    // Search pgvector (Postgres) or Keyword (SQLite)
    const results = await searchSimilar(id, queryEmbedding, limit, threshold, query);

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        filePath: r.filePath,
        startLine: r.startLine,
        endLine: r.endLine,
        symbolType: r.symbolType,
        symbolName: r.symbolName,
        language: r.language,
        content: r.content,
        score: Math.round(r.score * 100) / 100,
      })),
      totalResults: results.length,
    });
  } catch (error) {
    console.error("❌ Search API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/intelligence/[id]/search — Semantic code search via pgvector.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { repositories, users } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { generateLocalEmbedding } from "@/lib/local-ai";
import { decrypt } from "@/lib/crypto";
import { searchSimilar } from "@/lib/vector-search";
import { securityMiddleware } from "@/lib/security";
import { validateSearchQuery } from "@/lib/inputValidation";
import { logger } from "@/lib/monitoring";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    // Apply security middleware
    const securityResponse = await securityMiddleware(request);
    if (securityResponse) {
      return securityResponse;
    }

    const auth = await authenticateRequest(request);
    if (!auth) {
      logger.info('Unauthorized access attempt', {
        service: 'search-api',
        action: 'unauthorized-access',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      logger.info('Missing repository ID', {
        service: 'search-api',
        action: 'missing-repo-id',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Repository ID is required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam), 50) : 10;

    const thresholdParam = searchParams.get("threshold");
    const threshold = thresholdParam ? parseFloat(thresholdParam) : 0.5;

    // Validate search query
    const queryValidation = validateSearchQuery(query || "");
    if (!queryValidation.valid) {
      logger.info('Invalid search query', {
        service: 'search-api',
        action: 'invalid-query',
        query: query,
        error: queryValidation.message,
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: queryValidation.message },
        { status: 400 }
      );
    }

    if (!query || query.trim().length < 2) {
      logger.info('Search query too short', {
        service: 'search-api',
        action: 'query-too-short',
        query: query,
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Search query 'q' must be at least 2 characters" },
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
      logger.info('Repository not found', {
        service: 'search-api',
        action: 'repo-not-found',
        repoId: id,
        userId: auth.userId,
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const indexedStates = ["INDEXED", "DOCS_GENERATED", "READY"];
    if (!indexedStates.includes(repo.status)) {
      logger.info('Repository not indexed', {
        service: 'search-api',
        action: 'repo-not-indexed',
        repoId: id,
        status: repo.status,
        duration: Date.now() - startTime
      });
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
      logger.info('API key not configured', {
        service: 'search-api',
        action: 'no-api-key',
        userId: auth.userId,
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 400 }
      );
    }

    const apiKey = decrypt(user.encryptedGeminiKey);

    // Generate query embedding
    const queryEmbedding = await generateLocalEmbedding(query);

    // Search pgvector (Postgres) or Keyword (SQLite)
    const results = await searchSimilar(id, queryEmbedding, limit, threshold, query);

    logger.info('Search completed successfully', {
      service: 'search-api',
      action: 'search-success',
      repoId: id,
      query: query,
      results: results.length,
      duration: Date.now() - startTime
    });

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
    logger.error('Search API Error', {
      service: 'search-api',
      action: 'search-error',
      error: error instanceof Error ? error.message : "Internal server error",
      duration: Date.now() - startTime
    });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
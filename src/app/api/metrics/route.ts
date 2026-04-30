/**
 * Gitdocify — Metrics Endpoint
 *
 * Provides application metrics for monitoring and observability.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { repositories, users, codeChunks, jobs } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { logger } from "@/lib/monitoring";

export async function GET() {
  try {
    // Get database statistics
    const [userCount] = await db.select({ count: count() }).from(users);
    const [repoCount] = await db.select({ count: count() }).from(repositories);
    const [chunkCount] = await db.select({ count: count() }).from(codeChunks);
    const [jobCount] = await db.select({ count: count() }).from(jobs);

    const stats = {
      users: userCount.count,
      repositories: repoCount.count,
      codeChunks: chunkCount.count,
      jobs: jobCount.count,
    };

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    logger.error('Metrics collection failed', {
      service: 'metrics',
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
/**
 * GET /api/repos/[id] — Get repository details and status.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { repositories, jobs } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

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

    // Get latest jobs
    const repoJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.repoId, id))
      .orderBy(desc(jobs.createdAt))
      .limit(10);

    return NextResponse.json({
      repository: repo,
      jobs: repoJobs,
    });
  } catch (error) {
    console.error("Get repo error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

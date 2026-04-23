/**
 * GET /api/jobs/[id] — Get job status and progress.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, repositories } from "@/db/schema";
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

    // Get job
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Verify user access via repository
    const [repo] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.id, job.repoId),
          eq(repositories.userId, auth.userId)
        )
      );

    if (!repo) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      job: {
        id: job.id,
        repoId: job.repoId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
      repository: {
        id: repo.id,
        name: repo.name,
        status: repo.status,
      },
    });
  } catch (error) {
    console.error("Job status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

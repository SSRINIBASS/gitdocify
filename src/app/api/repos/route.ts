/**
 * /api/repos
 * POST — Ingest a GitHub repository (enqueue ingest job)
 * GET  — List user's repositories
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { repositories, jobs, users } from "@/db/schema";
import { JobStatus, JobType } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { parseGithubUrl } from "@/lib/git";
import { enqueueIngestJob } from "@/lib/queue";
import { eq, and, desc } from "drizzle-orm";
import { validateGithubUrl } from "@/lib/inputValidation";

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { repoUrl, force, teamId } = await request.json();

    if (!repoUrl) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    // Validate GitHub URL
    if (!validateGithubUrl(repoUrl)) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      );
    }

    // Check user has API key
    const [user] = await db
      .select({ encryptedGeminiKey: users.encryptedGeminiKey })
      .from(users)
      .where(eq(users.id, auth.userId));

    if (!user?.encryptedGeminiKey) {
      return NextResponse.json(
        { error: "Please configure your Gemini API key in Settings first" },
        { status: 400 }
      );
    }

    // Parse URL
    let repoInfo;
    try {
      repoInfo = parseGithubUrl(repoUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    // Check for existing
    const [existing] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.userId, auth.userId),
          eq(repositories.repoUrl, repoInfo.url)
        )
      );

    if (existing && !force) {
      return NextResponse.json({
        repository: existing,
        message: "Repository already exists. Use force=true to re-ingest.",
      });
    }

    // Create or reset repository
    let repo;
    if (existing && force) {
      [repo] = await db
        .update(repositories)
        .set({
          status: "CREATED",
          errorMessage: null,
          totalChunks: null,
          readmeContent: null,
          architectureContent: null,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, existing.id))
        .returning();
    } else {
      [repo] = await db
        .insert(repositories)
        .values({
          userId: auth.userId,
          teamId: teamId || null,
          repoUrl: repoInfo.url,
          name: repoInfo.name,
          owner: repoInfo.owner,
        })
        .returning();
    }

    // Create job
    const [job] = await db
      .insert(jobs)
      .values({
        repoId: repo.id,
        type: JobType.INGEST,
        status: JobStatus.PENDING,
      })
      .returning();

    // Enqueue BullMQ job
    await enqueueIngestJob({
      repoId: repo.id,
      jobId: job.id,
      repoUrl: repoInfo.url,
      userId: auth.userId,
    });

    return NextResponse.json(
      {
        repository: repo,
        job: { id: job.id, status: job.status },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ingest error:", error);
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

    const repos = await db
      .select()
      .from(repositories)
      .where(eq(repositories.userId, auth.userId))
      .orderBy(desc(repositories.createdAt));

    return NextResponse.json({ repositories: repos });
  } catch (error) {
    console.error("List repos error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

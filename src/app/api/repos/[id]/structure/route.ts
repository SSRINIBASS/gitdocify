/**
 * GET /api/repos/[id]/structure — Get file tree for a repository.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { getFilesSafely } from "@/lib/git";
import { buildFileTree } from "@/lib/chunking";
import path from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "./data";

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

    // Check repo is at least STRUCTURED
    const readyStates = ["STRUCTURED", "INDEXED", "DOCS_GENERATED", "READY"];
    if (!readyStates.includes(repo.status)) {
      return NextResponse.json(
        { error: `Repository must be structured first. Current status: ${repo.status}` },
        { status: 400 }
      );
    }

    const repoPath = path.join(STORAGE_PATH, "repos", id);
    const files = await getFilesSafely(repoPath);
    const tree = buildFileTree(files, repoPath);

    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Structure error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

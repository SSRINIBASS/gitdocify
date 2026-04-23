/**
 * Gitdocify — Docs Worker Processor
 *
 * Generates README and architecture documentation using Gemini.
 * Pipeline: INDEXED → DOCS_GENERATED → READY
 */

import { Job as BullJob } from "bullmq";
import { db } from "@/db";
import { repositories, jobs, codeChunks, users } from "@/db/schema";
import { RepoStatus, JobStatus } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateCompletion } from "@/lib/gemini";
import { decrypt } from "@/lib/crypto";
import type { DocsJobData } from "@/lib/queue";

const README_SYSTEM_PROMPT = `You are a technical documentation expert. Generate a comprehensive README.md for the given codebase.

Include:
1. Project title and description
2. Key features
3. Architecture overview
4. Getting started / installation
5. Usage examples
6. API reference (if applicable)
7. Technology stack

Base your documentation ONLY on the code context provided. Do not invent features or capabilities.
Format in clean Markdown.`;

const ARCHITECTURE_SYSTEM_PROMPT = `You are a software architect. Generate an architecture document for the given codebase.

Include:
1. System overview and design philosophy
2. Component breakdown (with file references)
3. Data flow diagrams (in Mermaid syntax)
4. Key design patterns used
5. Dependency graph
6. Entry points and critical paths

Base your analysis ONLY on the code context provided. Cite specific files and line numbers.
Format in clean Markdown with Mermaid diagrams where helpful.`;

export async function processDocsJob(job: BullJob<DocsJobData>) {
  const { repoId, jobId, userId } = job.data;
  console.log(`[docs] Starting job ${jobId} for repo ${repoId}`);

  try {
    // Mark job as running
    await db
      .update(jobs)
      .set({ status: JobStatus.RUNNING, startedAt: new Date() })
      .where(eq(jobs.id, jobId));

    // Get user's Gemini API key
    const [user] = await db
      .select({ encryptedGeminiKey: users.encryptedGeminiKey })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.encryptedGeminiKey) {
      throw new Error("Gemini API key not configured.");
    }

    const apiKey = decrypt(user.encryptedGeminiKey);

    // Get repo info
    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repoId));

    if (!repo) throw new Error("Repository not found");

    await job.updateProgress(10);

    // Get a representative sample of code chunks for context
    const chunks = await db
      .select({
        filePath: codeChunks.filePath,
        symbolType: codeChunks.symbolType,
        symbolName: codeChunks.symbolName,
        language: codeChunks.language,
        content: codeChunks.content,
        startLine: codeChunks.startLine,
        endLine: codeChunks.endLine,
      })
      .from(codeChunks)
      .where(eq(codeChunks.repoId, repoId))
      .limit(100);

    const codeContext = chunks
      .map(
        (c) =>
          `--- File: ${c.filePath} (lines ${c.startLine}-${c.endLine}) ---\n` +
          `Symbol: ${c.symbolName || "N/A"} (${c.symbolType || "code"})\n` +
          `\`\`\`${c.language || ""}\n${c.content}\n\`\`\``
      )
      .join("\n\n");

    const repoContext = `Repository: ${repo.owner}/${repo.name}\nLanguage: ${repo.primaryLanguage || "Multiple"}\nFiles: ${repo.totalFiles}\nChunks: ${repo.totalChunks}`;

    // Generate README
    console.log(`[docs] Generating README...`);
    const readmeContent = await generateCompletion(
      `${repoContext}\n\nCode Context:\n${codeContext}\n\nGenerate a comprehensive README.md for this project.`,
      README_SYSTEM_PROMPT,
      apiKey,
      0.4
    );

    await job.updateProgress(50);

    // Generate Architecture doc
    console.log(`[docs] Generating architecture doc...`);
    const architectureContent = await generateCompletion(
      `${repoContext}\n\nCode Context:\n${codeContext}\n\nGenerate an architecture document for this project.`,
      ARCHITECTURE_SYSTEM_PROMPT,
      apiKey,
      0.3
    );

    await job.updateProgress(90);

    // Store docs and update status: DOCS_GENERATED → READY
    await db
      .update(repositories)
      .set({
        readmeContent,
        architectureContent,
        status: RepoStatus.READY,
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, repoId));

    // Complete job
    await db
      .update(jobs)
      .set({ status: JobStatus.COMPLETED, progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    console.log(`[docs] Completed: README + Architecture generated`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[docs] Failed: ${errorMsg}`);

    await db
      .update(jobs)
      .set({ status: JobStatus.FAILED, errorMessage: errorMsg, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    // Don't mark repo as FAILED for docs - it's already INDEXED and usable
    throw error;
  }
}

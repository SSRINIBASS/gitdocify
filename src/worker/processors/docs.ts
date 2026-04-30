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
import { generateCompletion } from "@/lib/llm";
import { decrypt } from "@/lib/crypto";
import type { DocsJobData } from "@/lib/queue";
import { logger } from "@/lib/monitoring";
import { monitorWorkerJob } from "@/lib/workerMonitoring";

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

const MAX_CONTEXT_TOKENS = 12000;

export async function processDocsJob(job: BullJob<DocsJobData>) {
  const { repoId, jobId, userId } = job.data;
  console.log(`[docs] Starting job ${jobId} for repo ${repoId}`);

  return monitorWorkerJob('docs', jobId, async () => {
    try {
      // Mark job as running
      await db
        .update(jobs)
        .set({ status: JobStatus.RUNNING, startedAt: new Date() })
        .where(eq(jobs.id, jobId));

      await job.updateProgress(5);

      // Get user's Gemini API key
      const [user] = await db
        .select({ encryptedGeminiKey: users.encryptedGeminiKey })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.encryptedGeminiKey) {
        throw new Error("Gemini API key not configured. Please set your API key in Settings.");
      }

      const apiKey = decrypt(user.encryptedGeminiKey);

      await job.updateProgress(10);

      // Fetch code chunks for this repo (most significant ones first)
      const chunks = await db
        .select({
          filePath: codeChunks.filePath,
          startLine: codeChunks.startLine,
          endLine: codeChunks.endLine,
          symbolType: codeChunks.symbolType,
          symbolName: codeChunks.symbolName,
          language: codeChunks.language,
          content: codeChunks.content,
          tokenCount: codeChunks.tokenCount,
        })
        .from(codeChunks)
        .where(eq(codeChunks.repoId, repoId));

      if (chunks.length === 0) {
        console.log(`[docs] No chunks found, skipping documentation generation`);
        await db
          .update(repositories)
          .set({ status: RepoStatus.READY, updatedAt: new Date() })
          .where(eq(repositories.id, repoId));

        await db
          .update(jobs)
          .set({ status: JobStatus.COMPLETED, progress: 100, completedAt: new Date() })
          .where(eq(jobs.id, jobId));
        return;
      }

      console.log(`[docs] Found ${chunks.length} chunks for context`);
      await job.updateProgress(20);

      // Build context from chunks, staying within token budget
      // Prioritize: entry points, exports, main files, config files
      const prioritized = prioritizeChunks(chunks);
      const codeContext = buildContext(prioritized, MAX_CONTEXT_TOKENS);

      // Get repo info for context
      const [repo] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, repoId));

      const repoInfo = repo
        ? `Repository: ${repo.owner}/${repo.name}\nLanguage: ${repo.primaryLanguage || "Multiple"}\nFiles: ${repo.totalFiles || "Unknown"}\n\n`
        : "";

      // Generate README
      console.log(`[docs] Generating README...`);
      const readmePrompt = `${repoInfo}Code Context:\n\n${codeContext}\n\nGenerate a comprehensive README.md for this codebase.`;
      const readmeContent = await generateCompletion(
        readmePrompt,
        README_SYSTEM_PROMPT,
        apiKey,
        0.3
      );

      await job.updateProgress(50);

      // Generate Architecture document
      console.log(`[docs] Generating architecture documentation...`);
      const archPrompt = `${repoInfo}Code Context:\n\n${codeContext}\n\nGenerate an architecture document for this codebase.`;
      const architectureContent = await generateCompletion(
        archPrompt,
        ARCHITECTURE_SYSTEM_PROMPT,
        apiKey,
        0.3
      );

      await job.updateProgress(80);

      // Store generated docs in the repository record
      await db
        .update(repositories)
        .set({
          readmeContent,
          architectureContent,
          status: RepoStatus.DOCS_GENERATED,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, repoId));

      await job.updateProgress(90);

      // Mark as READY (final state)
      await db
        .update(repositories)
        .set({
          status: RepoStatus.READY,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, repoId));

      // Complete job
      await db
        .update(jobs)
        .set({ status: JobStatus.COMPLETED, progress: 100, completedAt: new Date() })
        .where(eq(jobs.id, jobId));

      console.log(`[docs] Completed: README (${readmeContent.length} chars) + Architecture (${architectureContent.length} chars)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[docs] Failed: ${errorMsg}`);

      await db
        .update(jobs)
        .set({ status: JobStatus.FAILED, errorMessage: errorMsg, completedAt: new Date() })
        .where(eq(jobs.id, jobId));

      // Don't set repo to FAILED for docs — it's already INDEXED and usable
      // Just log the error so the user can retry later

      throw error;
    }
  });
}

/**
 * Prioritize chunks for documentation context.
 * Entry points, exports, configs, and main files come first.
 */
interface ChunkInfo {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolType: string | null;
  symbolName: string | null;
  language: string | null;
  content: string;
  tokenCount: number | null;
}

function prioritizeChunks(chunks: ChunkInfo[]): ChunkInfo[] {
  const scored = chunks.map((chunk) => {
    let score = 0;

    // Prioritize entry points and config files
    const fp = chunk.filePath.toLowerCase();
    if (fp.includes("index.") || fp.includes("main.") || fp.includes("app.")) score += 10;
    if (fp.includes("package.json") || fp.includes("readme")) score += 15;
    if (fp.includes("config") || fp.includes("setup")) score += 8;
    if (fp.endsWith("route.ts") || fp.endsWith("route.js")) score += 6;
    if (fp.includes("schema") || fp.includes("model")) score += 7;
    if (fp.includes("test") || fp.includes("spec")) score -= 5;

    // Prioritize exports and classes
    const st = chunk.symbolType?.toLowerCase() || "";
    if (st === "export" || st === "class" || st === "interface") score += 5;
    if (st === "function" || st === "method") score += 3;

    // Larger chunks tend to be more significant
    const lines = chunk.endLine - chunk.startLine;
    if (lines > 20) score += 2;

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.chunk);
}

/**
 * Build a context string from prioritized chunks within a token budget.
 */
function buildContext(chunks: ChunkInfo[], maxTokens: number): string {
  const parts: string[] = [];
  let estimatedTokens = 0;

  for (const chunk of chunks) {
    const entry =
      `--- ${chunk.filePath} (L${chunk.startLine}-${chunk.endLine}) ---\n` +
      `${chunk.symbolType ? `[${chunk.symbolType}] ` : ""}${chunk.symbolName || ""}\n` +
      `\`\`\`${chunk.language || ""}\n${chunk.content}\n\`\`\``;

    const tokens = chunk.tokenCount || Math.ceil(chunk.content.split(/\s+/).length * 1.3);
    if (estimatedTokens + tokens > maxTokens) break;

    parts.push(entry);
    estimatedTokens += tokens;
  }

  return parts.join("\n\n");
}

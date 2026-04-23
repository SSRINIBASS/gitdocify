/**
 * Gitdocify — Index Worker Processor
 *
 * Handles AST chunking, Gemini embedding generation, and pgvector storage.
 * Pipeline: STRUCTURED → INDEXED
 * Auto-chains to documentation generation on success.
 */

import { Job as BullJob } from "bullmq";
import { db } from "@/db";
import { repositories, jobs, codeChunks } from "@/db/schema";
import { RepoStatus, JobStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFilesSafely } from "@/lib/git";
import { chunkRepository } from "@/lib/chunking";
import { generateEmbeddingsBatch } from "@/lib/gemini";
import { decrypt } from "@/lib/crypto";
import { storeEmbeddings } from "@/lib/vector-search";
import { enqueueDocsJob, type IndexJobData } from "@/lib/queue";
import { users } from "@/db/schema";
import path from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "./data";

export async function processIndexJob(job: BullJob<IndexJobData>) {
  const { repoId, jobId, userId } = job.data;
  console.log(`[index] Starting job ${jobId} for repo ${repoId}`);

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
      throw new Error("Gemini API key not configured. Please set your API key in Settings.");
    }

    const apiKey = decrypt(user.encryptedGeminiKey);

    await job.updateProgress(10);

    // Get files
    const repoPath = path.join(STORAGE_PATH, "repos", repoId);
    const files = await getFilesSafely(repoPath);

    // Chunk repository
    console.log(`[index] Chunking ${files.length} files...`);
    const chunks = await chunkRepository(repoPath, files);

    if (chunks.length === 0) {
      console.log(`[index] No chunks extracted, marking as indexed`);
      await db
        .update(repositories)
        .set({ status: RepoStatus.INDEXED, totalChunks: 0, updatedAt: new Date() })
        .where(eq(repositories.id, repoId));

      await db
        .update(jobs)
        .set({ status: JobStatus.COMPLETED, progress: 100, completedAt: new Date() })
        .where(eq(jobs.id, jobId));

      return;
    }

    console.log(`[index] Extracted ${chunks.length} chunks`);
    await job.updateProgress(30);

    // Insert chunks into database
    const chunkRecords = chunks.map((chunk) => ({
      repoId,
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      symbolType: chunk.symbolType,
      symbolName: chunk.symbolName,
      language: chunk.language,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
    }));

    // Insert in batches of 500
    const insertedIds: string[] = [];
    for (let i = 0; i < chunkRecords.length; i += 500) {
      const batch = chunkRecords.slice(i, i + 500);
      const inserted = await db.insert(codeChunks).values(batch).returning({ id: codeChunks.id });
      insertedIds.push(...inserted.map((r) => r.id));
    }

    await job.updateProgress(50);

    // Generate embeddings via Gemini
    console.log(`[index] Generating embeddings for ${chunks.length} chunks...`);
    const texts = chunks.map(
      (c) =>
        `File: ${c.filePath}\nSymbol: ${c.symbolName || "N/A"}\nType: ${c.symbolType || "code"}\nLines: ${c.startLine}-${c.endLine}\n\n${c.content}`
    );

    const embeddings = await generateEmbeddingsBatch(texts, apiKey, 10, 200);

    await job.updateProgress(80);

    // Store embeddings in pgvector
    console.log(`[index] Storing ${embeddings.length} embeddings...`);
    // Batch store embeddings in groups of 100
    for (let i = 0; i < insertedIds.length; i += 100) {
      const batchIds = insertedIds.slice(i, i + 100);
      const batchEmbeddings = embeddings.slice(i, i + 100);
      await storeEmbeddings(batchIds, batchEmbeddings);
    }

    await job.updateProgress(95);

    // Update repository: INDEXED
    await db
      .update(repositories)
      .set({
        status: RepoStatus.INDEXED,
        totalChunks: chunks.length,
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, repoId));

    // Complete job
    await db
      .update(jobs)
      .set({ status: JobStatus.COMPLETED, progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    console.log(`[index] Completed: ${chunks.length} chunks indexed`);

    // Chain: enqueue docs generation
    const [docsJob] = await db
      .insert(jobs)
      .values({
        repoId,
        type: "DOCS",
        status: JobStatus.PENDING,
      })
      .returning();

    await enqueueDocsJob({
      repoId,
      jobId: docsJob.id,
      userId,
    });

    console.log(`[index] Chained docs job ${docsJob.id}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[index] Failed: ${errorMsg}`);

    await db
      .update(jobs)
      .set({ status: JobStatus.FAILED, errorMessage: errorMsg, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await db
      .update(repositories)
      .set({ status: RepoStatus.FAILED, errorMessage: errorMsg, updatedAt: new Date() })
      .where(eq(repositories.id, repoId));

    throw error;
  }
}

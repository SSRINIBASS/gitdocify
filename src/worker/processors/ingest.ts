/**
 * Gitdocify — Ingest Worker Processor
 *
 * Handles repository cloning and structure analysis.
 * Pipeline: CREATED → CLONED → STRUCTURED
 * Auto-chains to the indexing job on success.
 */

import { Job as BullJob } from "bullmq";
import { db } from "@/db";
import { repositories, jobs, codeChunks } from "@/db/schema";
import { RepoStatus, JobStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cloneRepository, getFilesSafely, detectLanguage } from "@/lib/git";
import { enqueueIndexJob, type IngestJobData } from "@/lib/queue";
import path from "path";
import fs from "fs/promises";
import { logger } from "@/lib/monitoring";
import { monitorWorkerJob } from "@/lib/workerMonitoring";

export async function processIngestJob(job: BullJob<IngestJobData>) {
  const { repoId, jobId, repoUrl, userId } = job.data;

  return monitorWorkerJob('ingest', jobId, async () => {
    console.log(`[ingest] Starting job ${jobId} for repo ${repoId}`);

    try {
      // Mark job as running
      await db
        .update(jobs)
        .set({ status: JobStatus.RUNNING, startedAt: new Date() })
        .where(eq(jobs.id, jobId));

      await job.updateProgress(10);

      // Clone repository
      console.log(`[ingest] Cloning ${repoUrl}...`);
      const { clonePath, commitHash } = await cloneRepository(repoUrl, repoId);

      // Update repo: CLONED
      await db
        .update(repositories)
        .set({
          status: RepoStatus.CLONED,
          commitHash,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, repoId));

      await job.updateProgress(40);

      // Analyze structure
      console.log(`[ingest] Analyzing structure...`);
      const files = await getFilesSafely(clonePath);
      const totalFiles = files.length;

      // Calculate size and primary language
      let totalSize = 0;
      const langCounts: Record<string, number> = {};

      for (const file of files) {
        try {
          const stat = await fs.stat(file);
          totalSize += stat.size;
        } catch {
          /* skip */
        }

        const lang = detectLanguage(file);
        if (lang) {
          langCounts[lang] = (langCounts[lang] || 0) + 1;
        }
      }

      const primaryLanguage =
        Object.entries(langCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      // Update repo: STRUCTURED
      await db
        .update(repositories)
        .set({
          status: RepoStatus.STRUCTURED,
          totalFiles,
          totalSizeBytes: totalSize,
          primaryLanguage,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, repoId));

      await job.updateProgress(100);

      // Complete job
      await db
        .update(jobs)
        .set({
          status: JobStatus.COMPLETED,
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      console.log(
        `[ingest] Completed: ${totalFiles} files, ${primaryLanguage}, ${(totalSize / 1024).toFixed(0)}KB`
      );

      // Chain: enqueue indexing job
      const [indexJob] = await db
        .insert(jobs)
        .values({
          repoId,
          type: "INDEX",
          status: JobStatus.PENDING,
        })
        .returning();

      await enqueueIndexJob({
        repoId,
        jobId: indexJob.id,
        userId,
      });

      console.log(`[ingest] Chained index job ${indexJob.id}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ingest] Failed: ${errorMsg}`);

      await db
        .update(jobs)
        .set({
          status: JobStatus.FAILED,
          errorMessage: errorMsg,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      await db
        .update(repositories)
        .set({
          status: RepoStatus.FAILED,
          errorMessage: errorMsg,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, repoId));

      throw error;
    }
  });
}

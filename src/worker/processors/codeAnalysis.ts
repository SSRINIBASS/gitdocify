/**
 * Gitdocify — Code Analysis Worker Processor
 *
 * Performs advanced code analysis including quality metrics, dependency analysis,
 * and technical debt assessment.
 */

import { Job as BullJob } from "bullmq";
import { db } from "@/db";
import { repositories, jobs, codeChunks } from "@/db/schema";
import { RepoStatus, JobStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFilesSafely } from "@/lib/git";
import { generateCompletion } from "@/lib/llm";
import { decrypt } from "@/lib/crypto";
import { users } from "@/db/schema";
import path from "path";
import { logger } from "@/lib/monitoring";
import { monitorWorkerJob } from "@/lib/workerMonitoring";
import { analyzeCodeQuality, analyzeDependencies, assessTechnicalDebt } from "@/lib/codeAnalysis";
import type { CodeAnalysisJobData } from "@/lib/queue";

const STORAGE_PATH = process.env.STORAGE_PATH || "./data";

export async function processCodeAnalysisJob(job: BullJob<CodeAnalysisJobData>) {
  const { repoId, jobId, userId } = job.data;
  console.log(`[code-analysis] Starting job ${jobId} for repo ${repoId}`);

  return monitorWorkerJob('code-analysis', jobId, async () => {
    try {
      // Mark job as running
      await db
        .update(jobs)
        .set({ status: JobStatus.RUNNING, startedAt: new Date() })
        .where(eq(jobs.id, jobId));

      await job.updateProgress(10);

      // Get repo path
      const repoPath = path.join(STORAGE_PATH, "repos", repoId);
      const files = await getFilesSafely(repoPath);

      // Perform code analysis
      console.log(`[code-analysis] Analyzing code quality...`);
      const qualityMetrics = await analyzeCodeQuality(repoPath, files);
      await job.updateProgress(40);

      console.log(`[code-analysis] Analyzing dependencies...`);
      const dependencyAnalysis = await analyzeDependencies(repoPath);
      await job.updateProgress(70);

      console.log(`[code-analysis] Assessing technical debt...`);
      const debtAssessment = await assessTechnicalDebt(repoPath, files);
      await job.updateProgress(90);

      // Store analysis results in the repository record
      const analysisData = {
        quality: qualityMetrics,
        dependencies: dependencyAnalysis,
        debt: debtAssessment,
        analyzedAt: new Date().toISOString(),
      };

      await db
        .update(repositories)
        .set({
          codeAnalysisJson: JSON.stringify(analysisData),
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, repoId));

      // Complete job
      await db
        .update(jobs)
        .set({ status: JobStatus.COMPLETED, progress: 100, completedAt: new Date() })
        .where(eq(jobs.id, jobId));

      console.log(`[code-analysis] Completed: Analysis finished for repo ${repoId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[code-analysis] Failed: ${errorMsg}`);

      await db
        .update(jobs)
        .set({ status: JobStatus.FAILED, errorMessage: errorMsg, completedAt: new Date() })
        .where(eq(jobs.id, jobId));

      throw error;
    }
  });
}
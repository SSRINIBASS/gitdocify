/**
 * Gitdocify — BullMQ Queue Definitions
 *
 * Defines the three job queues (ingest, index, docs) and helper functions
 * for enqueuing jobs and tracking progress.
 */

import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

/* ─────────────── Queue Instances ─────────────── */

let ingestQueue: Queue | null = null;
let indexQueue: Queue | null = null;
let docsQueue: Queue | null = null;
let codeAnalysisQueue: Queue | null = null;

export function getIngestQueue(): Queue {
  if (!ingestQueue) {
    ingestQueue = new Queue("ingest", { connection: getRedisConnection() });
  }
  return ingestQueue;
}

export function getIndexQueue(): Queue {
  if (!indexQueue) {
    indexQueue = new Queue("index", { connection: getRedisConnection() });
  }
  return indexQueue;
}

export function getDocsQueue(): Queue {
  if (!docsQueue) {
    docsQueue = new Queue("docs", { connection: getRedisConnection() });
  }
  return docsQueue;
}

export function getCodeAnalysisQueue(): Queue {
  if (!codeAnalysisQueue) {
    codeAnalysisQueue = new Queue("code-analysis", { connection: getRedisConnection() });
  }
  return codeAnalysisQueue;
}

/* ─────────────── Job Enqueueing ─────────────── */

export interface IngestJobData {
  repoId: string;
  jobId: string;
  repoUrl: string;
  userId: string;
}

export interface IndexJobData {
  repoId: string;
  jobId: string;
  userId: string;
}

export interface DocsJobData {
  repoId: string;
  jobId: string;
  userId: string;
}

export interface CodeAnalysisJobData {
  repoId: string;
  jobId: string;
  userId: string;
}

export async function enqueueIngestJob(data: IngestJobData) {
  const queue = getIngestQueue();
  return queue.add("ingest", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function enqueueIndexJob(data: IndexJobData) {
  const queue = getIndexQueue();
  return queue.add("index", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function enqueueDocsJob(data: DocsJobData) {
  const queue = getDocsQueue();
  return queue.add("docs", data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function enqueueCodeAnalysisJob(data: CodeAnalysisJobData) {
  const queue = getCodeAnalysisQueue();
  return queue.add("code-analysis", data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

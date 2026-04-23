/**
 * Gitdocify — Worker Entry Point
 *
 * BullMQ worker process that consumes from ingest, index, and docs queues.
 * Run separately: `npx tsx src/worker/index.ts`
 */

import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "@/lib/queue";
import { processIngestJob } from "./processors/ingest";
import { processIndexJob } from "./processors/index";
import { processDocsJob } from "./processors/docs";

const connection = getRedisConnection();

console.log("🚀 Gitdocify Worker starting...");

// Ingest Worker
const ingestWorker = new Worker("ingest", processIngestJob, {
  connection,
  concurrency: 2,
});

ingestWorker.on("completed", (job) => {
  console.log(`✅ [ingest] Job ${job.id} completed`);
});

ingestWorker.on("failed", (job, err) => {
  console.error(`❌ [ingest] Job ${job?.id} failed: ${err.message}`);
});

// Index Worker
const indexWorker = new Worker("index", processIndexJob, {
  connection,
  concurrency: 1, // Embedding generation is heavy
});

indexWorker.on("completed", (job) => {
  console.log(`✅ [index] Job ${job.id} completed`);
});

indexWorker.on("failed", (job, err) => {
  console.error(`❌ [index] Job ${job?.id} failed: ${err.message}`);
});

// Docs Worker
const docsWorker = new Worker("docs", processDocsJob, {
  connection,
  concurrency: 2,
});

docsWorker.on("completed", (job) => {
  console.log(`✅ [docs] Job ${job.id} completed`);
});

docsWorker.on("failed", (job, err) => {
  console.error(`❌ [docs] Job ${job?.id} failed: ${err.message}`);
});

console.log("👷 Workers ready: ingest(2), index(1), docs(2)");

// Graceful shutdown
async function shutdown() {
  console.log("⏳ Shutting down workers...");
  await Promise.all([
    ingestWorker.close(),
    indexWorker.close(),
    docsWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

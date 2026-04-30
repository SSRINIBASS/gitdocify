/**
 * Gitdocify — Worker Performance Monitoring
 *
 * Monitors the performance of worker processes.
 */

import { logger } from "@/lib/monitoring";

// Function to monitor worker job performance
export async function monitorWorkerJob(
  jobType: string,
  jobId: string,
  jobFunction: () => Promise<any>
) {
  const startTime = Date.now();

  try {
    logger.info('Worker job started', {
      service: 'worker',
      jobType,
      jobId,
      action: 'job-started'
    });

    const result = await jobFunction();

    const duration = Date.now() - startTime;
    logger.info('Worker job completed', {
      service: 'worker',
      jobType,
      jobId,
      action: 'job-completed',
      duration: `${duration}ms`
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Worker job failed', {
      service: 'worker',
      jobType,
      jobId,
      action: 'job-failed',
      error: error instanceof Error ? error.message : "Unknown error",
      duration: `${duration}ms`
    });

    throw error;
  }
}

// Function to monitor database query performance
export async function monitorDatabaseQuery<T>(
  queryName: string,
  queryFunction: () => Promise<T>
) {
  const startTime = Date.now();

  try {
    logger.info('Database query started', {
      service: 'database',
      queryName,
      action: 'query-started'
    });

    const result = await queryFunction();

    const duration = Date.now() - startTime;
    logger.info('Database query completed', {
      service: 'database',
      queryName,
      action: 'query-completed',
      duration: `${duration}ms`
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database query failed', {
      service: 'database',
      queryName,
      action: 'query-failed',
      error: error instanceof Error ? error.message : "Unknown error",
      duration: `${duration}ms`
    });

    throw error;
  }
}
/**
 * Gitdocify — Monitoring & Observability
 *
 * Application performance monitoring and logging utilities.
 */

import winston from 'winston';
import { format, transports } from 'winston';
import path from 'path';

// Create a custom format for logging
const { combine, timestamp, printf, colorize, json } = format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, service, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${service || 'app'}: ${message} `;
  if (Object.keys(metadata).length > 0) {
    msg += JSON.stringify(metadata);
  }
  return msg;
});

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    logFormat
  ),
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp(),
        logFormat
      )
    }),
    // Write all logs to file in production
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'application.log'),
      format: combine(
        timestamp(),
        json()
      )
    })
  ]
});

// Add a method to log API requests
export function logApiRequest(
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  userId?: string
): void {
  logger.info('API Request', {
    service: 'api',
    method,
    url,
    statusCode,
    responseTime,
    userId
  });
}

// Add a method to log database operations
export function logDatabaseOperation(
  operation: string,
  table: string,
  duration: number,
  userId?: string
): void {
  logger.info('Database Operation', {
    service: 'database',
    operation,
    table,
    duration,
    userId
  });
}

// Add a method to log worker jobs
export function logWorkerJob(
  jobType: string,
  jobId: string,
  status: string,
  duration: number
): void {
  logger.info('Worker Job', {
    service: 'worker',
    jobType,
    jobId,
    status,
    duration
  });
}

// Add a method to log security events
export function logSecurityEvent(
  eventType: string,
  userId: string,
  ipAddress: string,
  userAgent: string
): void {
  logger.info('Security Event', {
    service: 'security',
    eventType,
    userId,
    ipAddress,
    userAgent
  });
}

// Add a method to log performance metrics
export function logPerformanceMetric(
  metricName: string,
  value: number,
  unit: string
): void {
  logger.info('Performance Metric', {
    service: 'performance',
    metricName,
    value,
    unit
  });
}

// Add a method to log errors
export function logError(
  error: Error,
  context: string,
  service: string
): void {
  logger.error('Error', {
    service,
    message: error.message,
    stack: error.stack,
    context
  });
}

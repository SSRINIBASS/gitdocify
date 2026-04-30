/**
 * Gitdocify — API Monitoring Middleware
 *
 * Middleware to monitor API requests and track performance metrics.
 */

import { NextRequest, NextFetchEvent } from 'next/server';
import { logger, logApiRequest } from '@/lib/monitoring';

interface ApiMetrics {
  method: string;
  url: string;
  startTime: number;
  userId?: string;
}

const apiMetricsMap = new Map<string, ApiMetrics>();

export function startApiMonitoring(requestId: string, method: string, url: string, userId?: string) {
  apiMetricsMap.set(requestId, {
    method,
    url,
    startTime: Date.now(),
    userId
  });
}

export function endApiMonitoring(requestId: string, statusCode: number) {
  const metrics = apiMetricsMap.get(requestId);
  if (metrics) {
    const responseTime = Date.now() - metrics.startTime;
    logApiRequest(
      metrics.method,
      metrics.url,
      statusCode,
      responseTime,
      metrics.userId
    );
    apiMetricsMap.delete(requestId);
  }
}

// Middleware function to wrap API route handlers
export function withMonitoring(handler: Function) {
  return async function (request: Request, ...args: any[]) {
    const requestId = Math.random().toString(36).substring(2, 15);
    const url = new URL(request.url);

    startApiMonitoring(
      requestId,
      request.method,
      url.pathname,
      // We would extract user ID from the request in a real implementation
      undefined
    );

    try {
      const result = await handler(request, ...args);

      // Log the result
      if (result && typeof result.json === 'function') {
        const jsonResult = await result.json();
        endApiMonitoring(requestId, result.status);
        return new Response(JSON.stringify(jsonResult), {
          status: result.status,
          statusText: result.statusText,
          headers: result.headers
        });
      }

      return result;
    } catch (error) {
      endApiMonitoring(requestId, 500);
      throw error;
    }
  };
}
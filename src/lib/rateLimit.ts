/**
 * Gitdocify — Rate Limiting Utility
 *
 * Simple in-memory rate limiter for API endpoints.
 * In a production environment, this should be replaced with
 * a distributed solution using Redis or similar.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if the request is allowed based on rate limiting rules
   */
  isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.requests.get(key);

    // If no entry exists or the window has passed, create a new one
    if (!entry || entry.resetTime <= now) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
      };
    }

    // If we're under the limit, increment the count
    if (entry.count < this.maxRequests) {
      entry.count++;
      this.requests.set(key, entry);
      return {
        allowed: true,
        remaining: this.maxRequests - entry.count,
        resetTime: entry.resetTime,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (entry.resetTime <= now) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Periodic cleanup to prevent memory leaks
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, this.windowMs);
  }
}

// Create rate limiters for different endpoints
export const authRateLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 10); // 10 requests per 15 minutes
export const apiRateLimiter = new InMemoryRateLimiter(60 * 1000, 100); // 100 requests per minute

export default InMemoryRateLimiter;
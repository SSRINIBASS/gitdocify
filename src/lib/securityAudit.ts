/**
 * Gitdocify — Security Audit Logging
 *
 * Audit logging for security-related events.
 */

import { db } from "@/db";
import { NextResponse } from "next/server";

export interface AuditLogEntry {
  userId?: string;
  ipAddress: string;
  action: string;
  resource?: string;
  status: "success" | "failure" | "blocked";
  timestamp: Date;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a security-related event
 */
export async function logSecurityEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // In a production environment, this would write to a dedicated audit log table
    // For now, we'll just log to console
    console.log(`[SECURITY] ${entry.action} - ${entry.ipAddress} - ${entry.status}`);
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

/**
 * Extract client information from request
 */
export function extractClientInfo(request: Request): { ipAddress: string; userAgent: string } {
  const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { ipAddress, userAgent };
}

/**
 * Log authentication events
 */
export async function logAuthenticationEvent(
  request: Request,
  userId: string | null,
  action: string,
  success: boolean
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(request);

  const entry: AuditLogEntry = {
    userId: userId || undefined,
    ipAddress,
    action,
    status: success ? "success" : "failure",
    timestamp: new Date(),
    userAgent,
  };

  await logSecurityEvent(entry);
}

/**
 * Security event types
 */
export const SecurityEvents = {
  LOGIN_ATTEMPT: "login_attempt",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILURE: "login_failure",
  REGISTRATION_ATTEMPT: "registration_attempt",
  REGISTRATION_SUCCESS: "registration_success",
  API_KEY_UPDATE: "api_key_update",
  API_KEY_ACCESS: "api_key_access",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  UNAUTHORIZED_ACCESS: "unauthorized_access",
} as const;

export type SecurityEventType = typeof SecurityEvents[keyof typeof SecurityEvents];
/**
 * Gitdocify — Health Check Endpoint
 *
 * Provides a health check endpoint for monitoring the application status.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Check database connectivity
    const dbCheck = await db.execute(sql`SELECT 1`);

    // Return health check response
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "ok",
      version: process.env.npm_package_version || "unknown"
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
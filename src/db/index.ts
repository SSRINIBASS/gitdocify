/**
 * Gitdocify — Polymorphic Database Client
 * 
 * Supports both PostgreSQL (primary) and SQLite (fallback).
 * Connects to PostgreSQL if DB_TYPE=postgres, otherwise defaults to SQLite.
 */

import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import pg from "pg";
import * as schema from "./schema";

const isPostgres = process.env.DB_TYPE === "postgres";

let db: any;
let pool: any;

if (isPostgres) {
  const { Pool } = pg;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  db = drizzlePg(pool, { schema });
} else {
  // SQLite Fallback
  const client = createClient({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });
  db = drizzleSqlite(client, { schema });
}

/**
 * Initialize database based on driver type.
 */
export async function initDatabase() {
  if (isPostgres) {
    const client = await pool.connect();
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      // ... (additional initialization logic as before)
    } finally {
      client.release();
    }
  } else {
    // SQLite doesn't need extensions like pgvector (we'll implement mock search)
    console.log("📂 Database: Initialized in SQLite fallback mode.");
  }
}

/**
 * Execute a raw SQL query.
 * Handles both PostgreSQL and SQLite drivers.
 */
export async function rawQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
  if (isPostgres) {
    const result = await pool.query(sql, params);
    return result.rows as T[];
  } else {
    // SQLite (LibSQL)
    const client = (db as any).$client;
    if (!client) {
      throw new Error("SQLite client not initialized");
    }
    const result = await client.execute({ sql, args: params });
    
    // Convert rows to plain objects (LibSQL returns rows as objects/arrays)
    return result.rows as unknown as T[];
  }
}

export { db, pool, isPostgres };

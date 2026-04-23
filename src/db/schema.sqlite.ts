/**
 * Gitdocify — SQLite Database Schema (Fallback)
 * 
 * Uses sqliteTable instead of pgTable. UUIDs are stored as text.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/* ─────────────────────────── Users ─────────────────────────── */

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  encryptedGeminiKey: text("encrypted_gemini_key"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/* ─────────────────────── Repositories ──────────────────────── */

export const repositories = sqliteTable("repositories", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repoUrl: text("repo_url").notNull(),
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  status: text("status").notNull().default("CREATED"),
  primaryLanguage: text("primary_language"),
  commitHash: text("commit_hash"),
  totalFiles: integer("total_files"),
  totalSizeBytes: integer("total_size_bytes"),
  totalChunks: integer("total_chunks"),
  errorMessage: text("error_message"),
  readmeContent: text("readme_content"),
  architectureContent: text("architecture_content"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/* ─────────────────────── Code Chunks ──────────────────────── */

export const codeChunks = sqliteTable("code_chunks", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  repoId: text("repo_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  symbolType: text("symbol_type"),
  symbolName: text("symbol_name"),
  language: text("language"),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/* ───────────────────────── Jobs ────────────────────────────── */

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  repoId: text("repo_id").references(() => repositories.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("PENDING"),
  progress: integer("progress").default(0),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/* ──────────────────── Tutor Sessions ──────────────────────── */

export const tutorSessions = sqliteTable("tutor_sessions", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  repoId: text("repo_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contextSummary: text("context_summary"),
  rollingSummary: text("rolling_summary"),
  lastActivityAt: integer("last_activity_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/* ──────────────────── Tutor Messages ──────────────────────── */

export const tutorMessages = sqliteTable("tutor_messages", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  sessionId: text("session_id").notNull().references(() => tutorSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  referencesJson: text("references_json"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/* ─────────────────── Status Enums ─────────────────────────── */

export const RepoStatus = {
  CREATED: "CREATED",
  CLONED: "CLONED",
  STRUCTURED: "STRUCTURED",
  INDEXED: "INDEXED",
  DOCS_GENERATED: "DOCS_GENERATED",
  READY: "READY",
  FAILED: "FAILED",
} as const;

export const JobType = {
  INGEST: "INGEST",
  INDEX: "INDEX",
  DOCS: "DOCS",
} as const;

export const JobStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type RepoStatusType = (typeof RepoStatus)[keyof typeof RepoStatus];
export type JobTypeType = (typeof JobType)[keyof typeof JobType];
export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus];

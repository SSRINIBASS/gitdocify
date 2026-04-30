/**
 * Gitdocify — Database Schema (Drizzle ORM + pgvector)
 *
 * All tables for the platform: users, repositories, code_chunks (with vector embeddings),
 * jobs, tutor_sessions, and tutor_messages.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ─────────────────────────── Users ─────────────────────────── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  encryptedGeminiKey: text("encrypted_gemini_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────────────────── Organizations ──────────────────────── */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_organizations_name").on(table.name),
]);

/* ─────────────────────────── Teams ─────────────────────────── */

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_teams_org_id").on(table.organizationId),
  index("idx_teams_name").on(table.name),
]);

/* ─────────────────────── Team Memberships ──────────────────────── */

export const teamMemberships = pgTable("team_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 64 }).notNull().default("member"), // 'owner', 'admin', 'member'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_team_memberships_user_id").on(table.userId),
  index("idx_team_memberships_team_id").on(table.teamId),
  uniqueIndex("idx_team_memberships_user_team").on(table.userId, table.teamId),
]);

/* ─────────────────────── Repositories ──────────────────────── */

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" }),
    repoUrl: varchar("repo_url", { length: 512 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    owner: varchar("owner", { length: 256 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("CREATED"),
    primaryLanguage: varchar("primary_language", { length: 64 }),
    commitHash: varchar("commit_hash", { length: 40 }),
    totalFiles: integer("total_files"),
    totalSizeBytes: integer("total_size_bytes"),
    totalChunks: integer("total_chunks"),
    errorMessage: text("error_message"),
    readmeContent: text("readme_content"),
    architectureContent: text("architecture_content"),
    codeAnalysisJson: text("code_analysis_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_repos_user_id").on(table.userId),
    index("idx_repos_team_id").on(table.teamId),
    index("idx_repos_status").on(table.status),
    uniqueIndex("idx_repos_user_url").on(table.userId, table.repoUrl),
  ]
);

/* ─────────────────────── Code Chunks ──────────────────────── */

/**
 * pgvector embedding column. Drizzle doesn't have native pgvector support,
 * so we use a customType-like approach via `sql` for the embedding column.
 * The actual column is created in the migration with `vector(768)`.
 */
export const codeChunks = pgTable(
  "code_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    filePath: varchar("file_path", { length: 1024 }).notNull(),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    symbolType: varchar("symbol_type", { length: 64 }),
    symbolName: varchar("symbol_name", { length: 256 }),
    language: varchar("language", { length: 64 }),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_chunks_repo_id").on(table.repoId)]
);

/* ───────────────────────── Jobs ────────────────────────────── */

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(), // INGEST, INDEX, DOCS
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    progress: integer("progress").default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_jobs_repo_id").on(table.repoId),
    index("idx_jobs_status").on(table.status),
  ]
);

/* ──────────────────── Tutor Sessions ──────────────────────── */

export const tutorSessions = pgTable("tutor_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contextSummary: text("context_summary"),
  rollingSummary: text("rolling_summary"),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ──────────────────── Tutor Messages ──────────────────────── */

export const tutorMessages = pgTable(
  "tutor_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => tutorSessions.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    referencesJson: text("references_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_messages_session_id").on(table.sessionId)]
);

/* ─────────────────── Type Exports ─────────────────────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type NewTeamMembership = typeof teamMemberships.$inferInsert;
export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
export type CodeChunk = typeof codeChunks.$inferSelect;
export type NewCodeChunk = typeof codeChunks.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type TutorSession = typeof tutorSessions.$inferSelect;
export type TutorMessage = typeof tutorMessages.$inferSelect;

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

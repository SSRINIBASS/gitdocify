import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema.sqlite";

const isPostgres = process.env.DB_TYPE === "postgres";

export const {
  users,
  repositories,
  codeChunks,
  jobs,
  tutorSessions,
  tutorMessages,
  RepoStatus,
  JobType,
  JobStatus
} = isPostgres ? (pgSchema as any) : (sqliteSchema as any);

// Export types if needed (types are usually shared or similar enough)
export type { Repository, CodeChunk, Job, TutorSession, TutorMessage } from "./schema.pg";

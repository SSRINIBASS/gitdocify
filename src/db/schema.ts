import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema.sqlite";

const isPostgres = process.env.DB_TYPE === "postgres";

const schema = isPostgres ? pgSchema : sqliteSchema;

export const users = schema.users;
export const organizations = schema.organizations;
export const teams = schema.teams;
export const teamMemberships = schema.teamMemberships;
export const repositories = schema.repositories;
export const codeChunks = schema.codeChunks;
export const jobs = schema.jobs;
export const tutorSessions = schema.tutorSessions;
export const tutorMessages = schema.tutorMessages;

export const RepoStatus = pgSchema.RepoStatus;
export const JobType = pgSchema.JobType;
export const JobStatus = pgSchema.JobStatus;

// Export types if needed (types are usually shared or similar enough)
export type { Repository, CodeChunk, Job, TutorSession, TutorMessage } from "./schema.pg";

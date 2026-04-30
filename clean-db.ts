import { db } from "./src/db";
import { sql } from "drizzle-orm";
import Redis from "ioredis";

async function clean() {
  console.log("Cleaning Database...");
  
  // Drizzle SQLite raw query to delete all records from all tables
  const tables = [
    'tutor_messages',
    'tutor_sessions',
    'jobs',
    'code_chunks',
    'repositories',
    'team_memberships',
    'teams',
    'organizations',
    'users'
  ];

  for (const table of tables) {
    try {
      await db.run(sql.raw(`DELETE FROM ${table};`));
      console.log(`- Cleared ${table}`);
    } catch (e) {
      console.error(`- Failed to clear ${table}:`, e);
    }
  }

  console.log("Cleaning Redis Queue...");
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.flushdb();
    console.log("- Cleared Redis Cache & Queues");
    redis.disconnect();
  } catch (e) {
    console.error("- Failed to clear Redis:", e);
  }

  console.log("Clean complete!");
  process.exit(0);
}

clean();

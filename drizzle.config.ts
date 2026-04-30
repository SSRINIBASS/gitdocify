import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

const isPostgres = process.env.DB_TYPE === "postgres";

export default defineConfig({
  schema: isPostgres ? "./src/db/schema.pg.ts" : "./src/db/schema.sqlite.ts",
  out: "./drizzle",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

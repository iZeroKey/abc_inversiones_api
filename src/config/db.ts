import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema/index.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

const isTest = env.NODE_ENV === "test" || process.env.VITEST === "true";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const queryClient = postgres(env.DATABASE_URL, {
  max: isTest ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: env.NODE_ENV !== "test",
  max_lifetime: 60 * 30,
});

export const db = drizzle(queryClient, { schema });

logger.info(
  {
    max: isTest ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 30,
    max_lifetime: 60 * 30,
  },
  "PostgreSQL client configured",
);

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema/index.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

const isTest = process.env.VITEST === "true";
const databaseUrl = isTest ? process.env.DATABASE_TEST_URL : env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    isTest
      ? "DATABASE_TEST_URL environment variable is not set"
      : "DATABASE_URL environment variable is not set",
  );
}

export const queryClient = postgres(databaseUrl, {
  max: isTest ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: false,
  max_lifetime: 60 * 1000,
});

export const db = drizzle(queryClient, { schema });

logger.info(
  { max: isTest ? 1 : 10, idle_timeout: 20 },
  "PostgreSQL client configured",
);
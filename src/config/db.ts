import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema/index.js";
import { env } from "./env.js";

const isTest = process.env.VITEST === "true";
const databaseUrl = isTest ? process.env.DATABASE_TEST_URL : env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    isTest
      ? "DATABASE_TEST_URL environment variable is not set"
      : "DATABASE_URL environment variable is not set",
  );
}

const queryClient = postgres(databaseUrl, {
  max: isTest ? 1 : 10,
  idle_timeout: 20,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export { queryClient };

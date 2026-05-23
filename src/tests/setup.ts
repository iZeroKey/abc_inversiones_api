import { execSync } from "child_process";
import "dotenv/config";
import { queryClient } from "../config/db.js";
import { env } from "../config/env.js";

const isSameValue = (
  left: string | undefined,
  right: string | undefined,
): boolean => !!left && !!right && left === right;

export async function setup() {
  console.log("Configurando entorno de prueba...");

  try {
    const testDatabaseUrl = process.env.DATABASE_URL_TEST || env.DATABASE_URL;
    const testSupabaseUrl = process.env.SUPABASE_URL_TEST || env.SUPABASE_URL;
    const testSupabaseAnonKey =
      process.env.SUPABASE_ANON_KEY_TEST || env.SUPABASE_ANON_KEY;
    const testSupabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY_TEST ||
      env.SUPABASE_SERVICE_ROLE_KEY;
    const sharedDatabaseUrl = isSameValue(
      process.env.DATABASE_URL,
      testDatabaseUrl,
    );
    const sharedSupabaseUrl = isSameValue(
      process.env.SUPABASE_URL,
      testSupabaseUrl,
    );

    if (sharedDatabaseUrl || sharedSupabaseUrl) {
      console.warn(
        "Aviso: las pruebas usarán los mismos recursos configurados fuera de TEST. Esto ejecuta app:reset sobre ese entorno.",
      );
    }

    const commandEnv = {
      ...process.env,
      NODE_ENV: "test",
      VITEST: "true",
      DATABASE_URL: testDatabaseUrl,
      SUPABASE_URL: testSupabaseUrl,
      SUPABASE_ANON_KEY: testSupabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: testSupabaseServiceRoleKey,
    };

    execSync("pnpm app:reset --confirm", {
      env: commandEnv,
      stdio: "inherit",
    });

    execSync("pnpm app:setup", {
      env: commandEnv,
      stdio: "inherit",
    });

    console.log("Entorno de prueba listo.");
  } catch (error) {
    console.error("Error en setup de pruebas:", error);
    throw error;
  }
}

export async function teardown() {
  try {
    await queryClient.end();
  } catch (error) {
    console.error("Error en teardown de pruebas:", error);
  }
}

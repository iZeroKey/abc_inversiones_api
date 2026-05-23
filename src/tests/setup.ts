import { execSync } from "child_process";
import "dotenv/config";
import { env } from "../config/env.js";
import { queryClient } from "../config/db.js";

export async function setup() {
  console.log("Configurando entorno de prueba...");

  try {
    const commandEnv = {
      ...process.env,
      NODE_ENV: "test",
      VITEST: "true",
      DATABASE_URL: env.DATABASE_URL,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
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

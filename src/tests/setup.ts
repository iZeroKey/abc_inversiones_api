import { execSync } from "child_process";
import "dotenv/config";
import { queryClient } from "../config/db.js";

export async function setup() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL no definida. Saltando setup de DB.");
    return;
  }

  console.log("Configurando entorno de prueba...");

  try {
    const commandEnv = {
      ...process.env,
      VITEST: "true",
    };

    execSync("pnpm reset:app --confirm", {
      env: commandEnv,
      stdio: "inherit",
    });

    execSync("pnpm exec drizzle-kit push --force", {
      env: commandEnv,
      stdio: "inherit",
    });

    execSync("pnpm setup:storage", {
      env: commandEnv,
      stdio: "inherit",
    });

    execSync("pnpm db:seed", {
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

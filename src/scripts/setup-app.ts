import { execSync } from "child_process";
import "dotenv/config";
import { queryClient } from "../config/db.js";
import { env } from "../config/env.js";
import { seed } from "./seed.js";
import { setupRls } from "./setup-rls.js";
import { setupStorage } from "./setup-storage.js";

/**
 * Ejecuta en orden:
 * 1. Push del esquema de Drizzle (crea/actualiza tablas)
 * 2. Configuración de RLS (políticas de seguridad)
 * 3. Configuración de Storage (buckets y políticas)
 * 4. Configuración de timezone de la base de datos
 * 5. Seed de datos iniciales (usuario administrador)
 */

function pushSchema(): void {
  console.log("Ejecutando drizzle-kit push...");
  execSync("npx drizzle-kit push", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("Esquema de base de datos sincronizado.");
}

async function setDatabaseTimezone(): Promise<void> {
  console.log(`\n[Timezone] Ajustando base de datos a: ${env.APP_TIMEZONE}...`);
  await queryClient.unsafe(
    `ALTER DATABASE postgres SET timezone TO '${env.APP_TIMEZONE}';`,
  );
  console.log("[Timezone] Zona horaria actualizada.");
}

async function setupApp(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  SETUP DE APLICACIÓN");
  console.log("=".repeat(60));

  try {
    // 1. Schema push
    console.log("\n--- Paso 1/5: Schema Push ---");
    pushSchema();

    // 2. RLS
    console.log("\n--- Paso 2/5: RLS ---");
    await setupRls();

    // 3. Storage
    console.log("\n--- Paso 3/5: Storage ---");
    await setupStorage();

    // 4. Timezone
    console.log("\n--- Paso 4/5: Timezone ---");
    await setDatabaseTimezone();

    // 5. Seed
    console.log("\n--- Paso 5/5: Seed ---");
    await seed();

    console.log("\n" + "=".repeat(60));
    console.log("  SETUP COMPLETADO EXITOSAMENTE");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nError fatal en setup de aplicación:", error);
    process.exitCode = 1;
  } finally {
    await queryClient.end();
  }
}

setupApp();

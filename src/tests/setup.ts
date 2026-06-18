import { execSync } from "child_process";
import "dotenv/config";
import { queryClient } from "../config/db.js";

export async function setup() {
  console.log("Configurando entorno de prueba...");

  try {
    execSync("pnpm app:reset --confirm", {
      stdio: "inherit",
    });

    execSync("pnpm app:setup", {
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

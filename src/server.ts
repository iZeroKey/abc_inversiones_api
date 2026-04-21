import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";

const { PORT, APP_NAME } = env;

const server = app.listen(PORT, () => {
  console.log(`[Server] ${APP_NAME} iniciado en puerto ${PORT}`);
});

const shutdown = (): void => {
  server.close((error) => {
    if (error) {
      console.error("[Server] Error al cerrar el servidor:", error);
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

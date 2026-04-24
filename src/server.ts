import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { realtimeService } from "./realtime/websocket.service.js";

const { PORT, APP_NAME } = env;

const server = createServer(app);
realtimeService.attach(server);

server.listen(PORT, () => {
  console.log(`[Server] ${APP_NAME} iniciado en puerto ${PORT}`);
});

const shutdown = (): void => {
  realtimeService.close();
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

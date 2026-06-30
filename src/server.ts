import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { realtimeService } from "./realtime/websocket.service.js";

const { PORT, APP_NAME } = env;

const server = createServer(app);
realtimeService.attach(server);

server.listen(PORT, () => {
  logger.info({ port: PORT, app: APP_NAME }, "Server started");
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = (): void => {
  logger.info("Shutting down server...");

  const forceExit = setTimeout(() => {
    logger.error("Shutdown timeout reached, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  realtimeService.close();
  server.close((error) => {
    clearTimeout(forceExit);
    if (error) {
      logger.error({ err: error }, "Error closing server");
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

import "dotenv/config";
import { app } from "./app.js";
import { env } from "./core/config/env.js";

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`${env.APP_NAME} listening on port ${env.PORT}`);
});

const shutdown = (): void => {
  server.close((error) => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Error while closing server", error);
      process.exit(1);
    }

    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

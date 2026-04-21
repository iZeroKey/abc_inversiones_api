import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { errorHandler } from "./core/middleware/error-handler.middleware.js";
import { requestIdMiddleware } from "./core/middleware/request-id.middleware.js";
import { sendError } from "./core/utils/response.util.js";
import { v1Routes } from "./routes/index.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(requestIdMiddleware);

app.use("/api/v1", v1Routes);

app.use((_request: Request, response: Response) => {
  return sendError(
    response,
    404,
    "Recurso no encontrado",
    "RESOURCE_NOT_FOUND",
  );
});

app.use(errorHandler);

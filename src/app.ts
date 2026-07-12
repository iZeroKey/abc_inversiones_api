import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware.js";
import { v1Routes } from "./routes/index.js";
import { env } from "./config/env.js";

export const app = express();

app.use(compression());
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

app.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-cache");
  next();
});

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    name: process.env.APP_NAME || "API",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", v1Routes);

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo global de errores
app.use(errorHandler);

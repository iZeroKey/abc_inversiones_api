import cors from "cors";
import express from "express";
import helmet from "helmet";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware.js";
import { v1Routes } from "./routes/index.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
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

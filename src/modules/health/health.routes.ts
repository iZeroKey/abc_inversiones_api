import { Router } from "express";
import { getHealth } from "./health.controller.js";

const healthRoutes = Router();

// /api/v1/health
healthRoutes.get("/health", getHealth);

export { healthRoutes };

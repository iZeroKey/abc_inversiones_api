import { Router } from "express";
import { getHealth } from "./health.controller.js";

const router = Router();

// GET /api/v1/health
router.get("/", getHealth);

export default router;

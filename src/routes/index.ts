import { Router } from "express";
import { healthRoutes } from "../modules/health/health.routes.js";

const v1Routes = Router();

v1Routes.use(healthRoutes);

export { v1Routes };

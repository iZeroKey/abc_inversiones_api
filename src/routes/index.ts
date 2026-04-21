import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";

const v1Routes = Router();

v1Routes.use(healthRoutes);
v1Routes.use(authRoutes);

export { v1Routes };

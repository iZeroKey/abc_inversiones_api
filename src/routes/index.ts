import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import healthRoutes from "../modules/health/health.routes.js";
import { usersRoutes } from "../modules/users/users.routes.js";

const v1Routes = Router();

v1Routes.use("/auth", authRoutes);
v1Routes.use("/health", healthRoutes);
v1Routes.use("/users", usersRoutes);

export { v1Routes };

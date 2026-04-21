import { Router } from "express";
import { login, logout, me, refresh } from "./auth.controller.js";

const authRoutes = Router();

// /api/v1/auth/login
authRoutes.post("/auth/login", login);

// /api/v1/auth/logout
authRoutes.post("/auth/logout", logout);

// /api/v1/auth/refresh
authRoutes.post("/auth/refresh", refresh);

// /api/v1/auth/me
authRoutes.get("/auth/me", me);

export { authRoutes };

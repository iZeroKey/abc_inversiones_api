import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import { login, logout, register } from "./auth.controller.js";

const router = Router();

// POST /api/v1/auth/login
router.post("/login", login);

// POST /api/v1/auth/logout
router.post("/logout", authenticate, logout);

// POST /api/v1/auth/register
router.post("/register", authenticate, authorize(["admin"]), register);

export default router;

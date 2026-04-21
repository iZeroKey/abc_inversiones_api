import { Router } from "express";
import { login, logout, register } from "./auth.controller.js";

const router = Router();

// POST /api/v1/auth/login
router.post("/login", login);

// POST /api/v1/auth/logout
router.post("/logout", logout);

// POST /api/v1/auth/register
router.post("/register", register);

export default router;

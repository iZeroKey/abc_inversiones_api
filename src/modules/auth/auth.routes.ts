import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import * as controller from "./auth.controller.js";

const router = Router();

// POST /api/v1/auth/login
router.post("/login", controller.login);

// POST /api/v1/auth/logout
router.post("/logout", authenticate, controller.logout);

// POST /api/v1/auth/register
router.post(
  "/register",
  authenticate,
  authorize(["admin"]),
  controller.register,
);

// POST /api/v1/auth/change-password
router.post("/change-password", authenticate, controller.changePassword);

export default router;

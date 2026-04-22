import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import * as usersController from "./users.controller.js";

const router = Router();

// Todas las rutas de usuarios requieren estar autenticado
router.use(authenticate);

// GET /api/v1/users/me
router.get("/me", usersController.getMe);

// GET /api/v1/users
router.get("/", authorize(["admin"]), usersController.getAllUsers);

// GET /api/v1/users/:id
router.get("/:id", usersController.getUserById);

// PATCH /api/v1/users/:id
router.patch("/:id", usersController.updateUser);

// DELETE /api/v1/users/:id
router.delete("/:id", authorize(["admin"]), usersController.deleteUser);

export { router as usersRoutes };

import { Router } from "express";
import * as controller from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authRateLimit } from "../../middleware/rate-limit.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Iniciar sesión en la plataforma y obtener token de sesión
 * @access  Public
 * @body    { email, password }
 */
router.post("/login", authRateLimit, controller.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refrescar la sesión usando el refresh_token emitido por login
 * @access  Public
 * @body    { refresh_token }
 */
router.post("/refresh", authRateLimit, controller.refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Cerrar la sesión activa del usuario
 * @access  Private
 */
router.post("/logout", authenticate, controller.logout);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Registrar manualmente un nuevo usuario. Owner puede crear cualquier rol; admin no owner solo client/investor. isOwner no se asigna por API.
 * @access  Private (Admin, Owner)
 * @body    { email, password, firstName, lastName, phone, role }
 */
router.post("/register", authenticate, authorize(["admin"]), controller.register);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Cambiar la contraseña del usuario autenticado tras verificar la actual
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.post("/change-password", authenticate, controller.changePassword);

export default router;

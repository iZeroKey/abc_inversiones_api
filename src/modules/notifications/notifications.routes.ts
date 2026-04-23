import { Router } from "express";
import * as controller from "./notifications.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/notifications
 * @desc    Obtener notificaciones del usuario actual
 * @access  Private
 */
router.get("/", authenticate, controller.getMyNotifications);

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Marcar todas las notificaciones como leídas
 * @access  Private
 */
router.patch("/read-all", authenticate, controller.markAllAsRead);

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Marcar una notificación específica como leída
 * @access  Private
 */
router.patch("/:id/read", authenticate, controller.markAsRead);

export { router as notificationsRoutes };

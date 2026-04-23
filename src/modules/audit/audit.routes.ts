import { Router } from "express";
import * as controller from "./audit.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/audit-logs
 * @desc    Listar logs de auditoría con filtros opcionales (module, action, userId, from, to, limit)
 * @access  Private (Admin, Owner)
 */
router.get("/", authenticate, authorize(["admin"]), controller.getAuditLogs);

/**
 * @route   GET /api/v1/audit-logs/user/:userId
 * @desc    Obtener el historial de auditoría de un usuario específico
 * @access  Private (Admin, Owner)
 */
router.get("/user/:userId", authenticate, authorize(["admin"]), controller.getAuditLogsByUser);

export { router as auditRoutes };

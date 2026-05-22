import { Router } from "express";
import * as controller from "./access-requests.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { publicRequestRateLimit } from "../../middleware/rate-limit.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/access-requests
 * @desc    Enviar una nueva solicitud de acceso a la plataforma
 * @access  Public
 * @body    { email, firstName, lastName, phone, roleRequested, additionalData }
 */
router.post("/", publicRequestRateLimit, controller.createRequest);

/**
 * @route   GET /api/v1/access-requests
 * @desc    Listar todas las solicitudes de acceso (Pendientes, en revisión, etc.)
 * @access  Private (Admin, Owner)
 */
router.get("/", authenticate, authorize(["admin"]), controller.getAllRequests);

/**
 * @route   GET /api/v1/access-requests/:id
 * @desc    Obtener el detalle completo de una solicitud de acceso específica
 * @access  Private (Admin, Owner)
 */
router.get("/:id", authenticate, authorize(["admin"]), controller.getRequestById);

/**
 * @route   PATCH /api/v1/access-requests/:id/status
 * @desc    Actualizar el estado de una solicitud. Si se aprueba, crea el usuario automáticamente.
 * @access  Private (Admin, Owner)
 * @body    { status, observation, initialPassword }
 */
router.patch("/:id/status", authenticate, authorize(["admin"]), controller.updateStatus);

export { router as accessRequestsRoutes };

import { Router } from "express";
import * as controller from "./loans.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/loans
 * @desc    Crear un nuevo préstamo. Solo accesible por administradores.
 * @access  Private (Admin, Owner)
 * @body    { clientId, investorId, principal, interestRate, installmentsCount, frequency, startDate }
 */
router.post("/", authenticate, authorize(["admin"]), controller.createLoan);

/**
 * @route   GET /api/v1/loans
 * @desc    Listar préstamos. Filtra automáticamente según el rol (Cliente ve los suyos, Inversionista los que financia).
 * @access  Private
 */
router.get("/", authenticate, controller.getAllLoans);

/**
 * @route   GET /api/v1/loans/summary
 * @desc    Obtener resumen financiero (Stats, Próximo pago, Mora) según el rol.
 * @access  Private
 */
router.get("/summary", authenticate, controller.getSummary);

/**
 * @route   GET /api/v1/loans/admin-summary
 * @desc    Tabla resumen administrativa de préstamos para la vista de gestión.
 * @access  Private (Admin, Owner)
 */
router.get("/admin-summary", authenticate, authorize(["admin"]), controller.getAdminLoanSummary);

/**
 * @route   GET /api/v1/loans/:id
 * @desc    Obtener detalle de un préstamo específico.
 * @access  Private
 */
router.get("/:id", authenticate, controller.getLoanById);

/**
 * @route   GET /api/v1/loans/:id/installments
 * @desc    Obtener el cronograma de pagos (cuotas) de un préstamo.
 * @access  Private
 */
router.get("/:id/installments", authenticate, controller.getLoanInstallments);

/**
 * @route   PATCH /api/v1/loans/:id/approve
 * @desc    Aprobar un préstamo. Si es Inversionista, pasa a revisión de Admin. Si es Admin, activa el préstamo y genera cuotas.
 * @access  Private
 */
router.patch("/:id/approve", authenticate, controller.approveLoan);

/**
 * @route   PATCH /api/v1/loans/:id/reject
 * @desc    Rechazar un préstamo. Inversionista rechaza desde pending_investor_review, Admin/Dueño desde pending_admin_review.
 * @access  Private (Admin, Owner, Investor asignado)
 * @body    { observation? }
 */
router.patch("/:id/reject", authenticate, controller.rejectLoan);

export { router as loansRoutes };

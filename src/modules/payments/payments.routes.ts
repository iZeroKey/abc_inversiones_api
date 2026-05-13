import { Router } from "express";
import * as controller from "./payments.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import { streamVoucherUpload } from "../../middleware/stream-upload.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/payments
 * @desc    Registrar un nuevo pago de un cliente. Aplica el monto a las cuotas pendientes automáticamente.
 * @access  Private (Admin, Owner)
 * @body    { loanId, amount, method, reference, observation, paymentDate } + evidence opcional en multipart/form-data
 */
router.post("/", authenticate, authorize(["admin"]), streamVoucherUpload, controller.registerPayment);

/**
 * @route   GET /api/v1/payments/loan/:loanId
 * @desc    Obtener el historial de pagos registrados para un préstamo específico.
 * @access  Private
 */
router.get("/loan/:loanId", authenticate, controller.getPaymentsByLoan);

/**
 * @route   PATCH /api/v1/payments/:id
 * @desc    Editar un pago manual/aplicado y recalcular el préstamo.
 * @access  Private (Admin, Owner)
 */
router.patch("/:id", authenticate, authorize(["admin"]), controller.updatePayment);

/**
 * @route   DELETE /api/v1/payments/:id
 * @desc    Eliminar lógicamente un pago y recalcular el préstamo.
 * @access  Private (Admin, Owner)
 */
router.delete("/:id", authenticate, authorize(["admin"]), controller.deletePayment);

export { router as paymentsRoutes };

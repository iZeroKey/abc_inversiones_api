import { Router } from "express";
import * as controller from "./payment-vouchers.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/payment-vouchers
 * @desc    Subir un nuevo comprobante de pago (Voucher)
 * @access  Private (Client)
 */
router.post("/", authenticate, authorize(["client"]), controller.submitVoucher);

/**
 * @route   GET /api/v1/payment-vouchers
 * @desc    Listar vouchers (Admin ve todos, Cliente los suyos, Inversionista los de sus préstamos)
 * @access  Private
 */
router.get("/", authenticate, controller.getVouchers);

/**
 * @route   PATCH /api/v1/payment-vouchers/:id/process
 * @desc    Aprobar o rechazar un voucher. Si se aprueba, se aplica el pago al préstamo.
 * @access  Private (Admin, Investor)
 */
router.patch("/:id/process", authenticate, authorize(["admin", "investor"]), controller.processVoucher);

export { router as paymentVouchersRoutes };

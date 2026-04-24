import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import { uploadImage } from "../../middleware/upload.middleware.js";
import * as controller from "./payment-vouchers.controller.js";
import * as ocrController from "./payment-vouchers.ocr.controller.js";

const router = Router();

/**
 * @route   POST /api/v1/payment-vouchers/analyze
 * @desc    Analizar un comprobante en backend con OCR y devolver JSON sugerido.
 *          No persiste la imagen ni crea el voucher.
 * @access  Private (Client)
 */
router.post("/analyze", authenticate, authorize(["client"]), uploadImage.single("evidence"), ocrController.analyzeVoucherEvidence);

/**
 * @route   POST /api/v1/payment-vouchers
 * @desc    Subir un nuevo comprobante de pago (Voucher) con la imagen y los datos
 *          finales confirmados por el cliente. Acepta imagen como multipart/form-data.
 * @access  Private (Client)
 * @body    { loanId, amount, operationId, operationDate?, observation? } + campo "evidence" (imagen)
 */
router.post("/", authenticate, authorize(["client"]), uploadImage.single("evidence"), controller.submitVoucher);

/**
 * @route   GET /api/v1/payment-vouchers
 * @desc    Listar vouchers (Admin ve todos, Cliente los suyos, Inversionista los de sus préstamos)
 * @access  Private
 */
router.get("/", authenticate, controller.getVouchers);

/**
 * @route   GET /api/v1/payment-vouchers/operation-id/exists
 * @desc    Verificar rápidamente si un operationId ya existe.
 * @access  Private (Client)
 */
router.get("/operation-id/exists", authenticate, authorize(["client"]), controller.checkOperationIdExists);

/**
 * @route   PATCH /api/v1/payment-vouchers/:id/process
 * @desc    Aprobar o rechazar un voucher. Si se aprueba, se aplica el pago al préstamo.
 * @access  Private (Admin, Investor)
 */
router.patch("/:id/process", authenticate, authorize(["admin", "investor"]), controller.processVoucher);

export { router as paymentVouchersRoutes };

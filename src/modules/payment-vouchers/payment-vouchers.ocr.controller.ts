import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";
import { analyzeVoucherImage } from "./payment-vouchers.ocr.service.js";

/**
 * Analiza una imagen de voucher y devuelve datos sugeridos por OCR.
 * Este endpoint NO guarda la imagen ni crea el voucher final.
 * Su propósito es asistir al frontend para prellenar el formulario
 * antes de que el usuario confirme o corrija manualmente los datos.
 */
export const analyzeVoucherEvidence = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 400, "Debes adjuntar una imagen en el campo evidence");
      return;
    }

    const analysis = await analyzeVoucherImage(req.file.buffer, req.file.mimetype);
    sendSuccess(res, 200, "Imagen analizada correctamente", analysis);
  } catch (error: any) {
    sendError(res, 500, error.message || "Error al analizar la imagen", error);
  }
};

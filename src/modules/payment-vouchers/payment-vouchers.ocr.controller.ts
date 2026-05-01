import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";
import { analyzeVoucherImage } from "./payment-vouchers.ocr.service.js";

/**
 * Analiza una imagen de voucher y devuelve datos sugeridos por OCR.
 * Este endpoint NO guarda la imagen ni crea el voucher final.
 * Su propósito es asistir al frontend para prellenar el formulario
 * antes de que el usuario confirme o corrija manualmente los datos.
 *
 * Usa el modo "buffer" del stream-parser porque Google Vision API
 * requiere la imagen completa (no soporta streaming).
 * Límite reducido a 1.5MB (suficiente para OCR de vouchers bancarios).
 */
export const analyzeVoucherEvidence = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Fuente de datos: busboy buffer
    const parsedFile = req.streamParsed?.file;

    const buffer = parsedFile?.buffer;
    const mimeType = parsedFile?.mimetype;

    if (!buffer || !mimeType) {
      sendError(res, 400, "Debes adjuntar una imagen en el campo evidence");
      return;
    }

    const analysis = await analyzeVoucherImage(buffer, mimeType);
    sendSuccess(res, 200, "Imagen analizada correctamente", analysis);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al analizar la imagen";
    sendError(res, 500, message, error);
  }
};

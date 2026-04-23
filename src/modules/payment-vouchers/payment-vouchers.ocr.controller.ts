import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";
import { analyzeVoucherImage } from "./payment-vouchers.ocr.service.js";

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

import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";
import { analyzeVoucherImage } from "./payment-vouchers.ocr.service.js";

export const analyzeVoucherEvidence = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
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
    const message =
      error instanceof Error ? error.message : "Error al analizar la imagen";
    sendError(res, 500, message, error);
  }
};

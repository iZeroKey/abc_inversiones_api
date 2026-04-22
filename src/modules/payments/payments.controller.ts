import { Response } from "express";
import { db } from "../../config/db.js";
import { payments } from "../../db/schema/payments.js";
import { eq, desc } from "drizzle-orm";
import {
  sendSuccess,
  sendError,
  formatZodError,
} from "../../utils/response.util.js";
import { createPaymentSchema } from "./payments.schema.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { processPaymentLogic } from "./payments.service.js";
import { logAudit } from "../../utils/audit.util.js";

export const registerPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const result = await processPaymentLogic({
      ...validation.data,
      registeredById: req.user!.id,
      paymentDate: validation.data.paymentDate ? new Date(validation.data.paymentDate) : new Date(),
    });

    await logAudit({
      userId: req.user!.id,
      action: "REGISTER_MANUAL_PAYMENT",
      module: "PAYMENTS",
      entityId: result.id,
      newData: result,
      req,
    });

    sendSuccess(res, 201, "Pago registrado y aplicado correctamente", result);
  } catch (error: any) {
    sendError(res, 500, error.message || "Error al registrar el pago", error);
  }
};

export const getPaymentsByLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const loanId = req.params.loanId as string;
    const results = await db.select()
      .from(payments)
      .where(eq(payments.loanId, loanId))
      .orderBy(desc(payments.paymentDate));

    sendSuccess(res, 200, "Pagos obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener pagos", error);
  }
};

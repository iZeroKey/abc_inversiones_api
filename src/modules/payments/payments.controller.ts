import { and, desc, eq, isNull } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { loans } from "../../db/schema/loans.js";
import { payments } from "../../db/schema/payments.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import { createPaymentSchema, updatePaymentSchema } from "./payments.schema.js";
import { PaymentBusinessError, processPaymentLogic, recalculateLoanLedger } from "./payments.service.js";

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al registrar el pago";
    const status = error instanceof PaymentBusinessError ? error.statusCode : 500;
    sendError(res, status, message, error);
  }
};

export const getPaymentsByLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const loanId = req.params.loanId as string;
    const user = req.user!;

    const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
    if (!loan) {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    const hasAccess =
      user.role === "admin" ||
      user.isOwner ||
      (user.role === "client" && loan.clientId === user.id) ||
      (user.role === "investor" && loan.investorId === user.id);

    if (!hasAccess) {
      sendError(res, 403, "No tienes acceso a los pagos de este préstamo");
      return;
    }

    const results = await db.select()
      .from(payments)
      .where(and(eq(payments.loanId, loanId), isNull(payments.deletedAt)))
      .orderBy(desc(payments.paymentDate));

    sendSuccess(res, 200, "Pagos obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener pagos", error);
  }
};

export const updatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validation = updatePaymentSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [oldPayment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!oldPayment || oldPayment.deletedAt) {
      sendError(res, 404, "Pago no encontrado");
      return;
    }

    const [loan] = await db.select().from(loans).where(eq(loans.id, oldPayment.loanId)).limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(res, 400, "No se puede modificar un pago de un préstamo eliminado");
      return;
    }

    const [updatedPayment] = await db.update(payments)
      .set({
        ...validation.data,
        paymentDate: validation.data.paymentDate ? new Date(validation.data.paymentDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    const recalculated = await recalculateLoanLedger(oldPayment.loanId);

    await logAudit({
      userId: req.user!.id,
      action: "UPDATE_PAYMENT",
      module: "PAYMENTS",
      entityId: id,
      oldData: oldPayment,
      newData: updatedPayment,
      req,
    });

    sendSuccess(res, 200, "Pago actualizado correctamente", {
      payment: updatedPayment,
      loan: recalculated.loan,
      overpaidAmount: recalculated.overpaidAmount,
    });
  } catch (error) {
    sendError(res, 500, "Error al actualizar pago", error);
  }
};

export const deletePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [oldPayment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!oldPayment || oldPayment.deletedAt) {
      sendError(res, 404, "Pago no encontrado");
      return;
    }

    const [loan] = await db.select().from(loans).where(eq(loans.id, oldPayment.loanId)).limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(res, 400, "No se puede eliminar un pago de un préstamo eliminado");
      return;
    }

    const [deletedPayment] = await db.update(payments)
      .set({
        deletedAt: new Date(),
        status: "reversed",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    const recalculated = await recalculateLoanLedger(oldPayment.loanId);

    await logAudit({
      userId: req.user!.id,
      action: "DELETE_PAYMENT",
      module: "PAYMENTS",
      entityId: id,
      oldData: oldPayment,
      newData: deletedPayment,
      req,
    });

    sendSuccess(res, 200, "Pago eliminado correctamente", {
      payment: deletedPayment,
      loan: recalculated.loan,
      overpaidAmount: recalculated.overpaidAmount,
    });
  } catch (error) {
    sendError(res, 500, "Error al eliminar pago", error);
  }
};

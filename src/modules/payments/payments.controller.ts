import { and, desc, eq, isNull } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { loans } from "../../db/schema/loans.js";
import { payments } from "../../db/schema/payments.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import { emitLoanDomainEvent } from "../../utils/realtime.util.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import {
  deleteStorageReference,
  resolveFileUrl,
  uploadFileStream,
} from "../../utils/storage.util.js";
import { createPaymentSchema, updatePaymentSchema } from "./payments.schema.js";
import {
  PaymentBusinessError,
  processPaymentLogic,
  recalculateLoanLedger,
} from "./payments.service.js";

const attachSignedEvidenceUrl = async <
  T extends { evidenceUrl?: string | null },
>(
  payment: T,
): Promise<T> => {
  if (!payment.evidenceUrl) {
    return payment;
  }

  return {
    ...payment,
    evidenceUrl: await resolveFileUrl(payment.evidenceUrl),
  };
};

export const registerPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  let evidenceUrl: string | null = null;

  try {
    const streamParsed = req.streamParsed;
    const hasStreamFields =
      streamParsed && Object.keys(streamParsed.fields).length > 0;
    const bodySource = hasStreamFields ? streamParsed.fields : req.body;
    const validation = createPaymentSchema.safeParse(bodySource);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    if (streamParsed?.fileStream) {
      evidenceUrl = await uploadFileStream(
        "vouchers",
        validation.data.loanId,
        streamParsed.fileStream.stream,
        streamParsed.fileStream.generatedName,
        streamParsed.fileStream.mimetype,
      );
    }

    const result = await processPaymentLogic({
      ...validation.data,
      registeredById: req.user!.id,
      paymentDate: validation.data.paymentDate
        ? new Date(validation.data.paymentDate)
        : new Date(),
      evidenceUrl,
    });
    const responsePayment = await attachSignedEvidenceUrl(result);

    await logAudit({
      userId: req.user!.id,
      action: "REGISTER_MANUAL_PAYMENT",
      module: "PAYMENTS",
      entityId: result.id,
      newData: result,
      req,
    });

    const [loan] = await db
      .select({ clientId: loans.clientId, investorId: loans.investorId })
      .from(loans)
      .where(eq(loans.id, result.loanId))
      .limit(1);

    emitLoanDomainEvent("payment.created", {
      loanId: result.loanId,
      paymentId: result.id,
      clientId: loan?.clientId,
      investorId: loan?.investorId,
    });
    sendSuccess(
      res,
      201,
      "Pago registrado y aplicado correctamente",
      responsePayment,
    );
  } catch (error: unknown) {
    if (evidenceUrl) {
      await deleteStorageReference(evidenceUrl).catch(() => {});
    }

    const message =
      error instanceof Error ? error.message : "Error al registrar el pago";
    const status =
      error instanceof PaymentBusinessError ? error.statusCode : 500;
    sendError(res, status, message, error);
  }
};

export const getPaymentsByLoan = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const loanId = req.params.loanId as string;
    const user = req.user!;

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);
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

    const results = await db
      .select()
      .from(payments)
      .where(and(eq(payments.loanId, loanId), isNull(payments.deletedAt)))
      .orderBy(desc(payments.paymentDate));
    const signedResults = await Promise.all(
      results.map((payment) => attachSignedEvidenceUrl(payment)),
    );

    sendSuccess(res, 200, "Pagos obtenidos", signedResults);
  } catch (error) {
    sendError(res, 500, "Error al obtener pagos", error);
  }
};

export const updatePayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validation = updatePaymentSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [oldPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    if (!oldPayment || oldPayment.deletedAt) {
      sendError(res, 404, "Pago no encontrado");
      return;
    }

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, oldPayment.loanId))
      .limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(
        res,
        400,
        "No se puede modificar un pago de un préstamo eliminado",
      );
      return;
    }

    const [updatedPayment] = await db
      .update(payments)
      .set({
        ...validation.data,
        paymentDate: validation.data.paymentDate
          ? new Date(validation.data.paymentDate)
          : undefined,
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

    emitLoanDomainEvent("payment.updated", {
      loanId: updatedPayment.loanId,
      paymentId: updatedPayment.id,
      clientId: loan.clientId,
      investorId: loan.investorId,
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

export const deletePayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [oldPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    if (!oldPayment || oldPayment.deletedAt) {
      sendError(res, 404, "Pago no encontrado");
      return;
    }

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, oldPayment.loanId))
      .limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(
        res,
        400,
        "No se puede eliminar un pago de un préstamo eliminado",
      );
      return;
    }

    const [deletedPayment] = await db
      .update(payments)
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

    emitLoanDomainEvent("payment.deleted", {
      loanId: deletedPayment.loanId,
      paymentId: deletedPayment.id,
      clientId: loan.clientId,
      investorId: loan.investorId,
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

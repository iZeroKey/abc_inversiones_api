import { Response } from "express";
import { db } from "../../config/db.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { loans } from "../../db/schema/loans.js";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  sendSuccess,
  sendError,
  formatZodError,
} from "../../utils/response.util.js";
import { createVoucherSchema, processVoucherSchema } from "./payment-vouchers.schema.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { processPaymentLogic } from "../payments/payments.service.js";
import { logAudit } from "../../utils/audit.util.js";
import { sendNotification } from "../../utils/notification.util.js";

export const submitVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createVoucherSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const clientId = req.user!.id;
    const { loanId, operationId } = validation.data;

    const [existing] = await db.select()
      .from(paymentVouchers)
      .where(eq(paymentVouchers.operationId, operationId))
      .limit(1);
    
    if (existing) {
      sendError(res, 409, "Este ID de operación ya ha sido registrado previamente");
      return;
    }

    const [loan] = await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.clientId, clientId))).limit(1);
    if (!loan) {
      sendError(res, 403, "No tienes acceso a este préstamo");
      return;
    }

    const [newVoucher] = await db.insert(paymentVouchers).values({
      ...validation.data,
      operationDate: validation.data.operationDate ? new Date(validation.data.operationDate) : new Date(),
      clientId,
      status: "pending_investor_review",
    }).returning();

    await logAudit({
      userId: clientId,
      action: "SUBMIT_VOUCHER",
      module: "VOUCHERS",
      entityId: newVoucher.id,
      newData: newVoucher,
      req,
    });

    sendSuccess(res, 201, "Voucher enviado para revisión del inversionista", newVoucher);
  } catch (error) {
    sendError(res, 500, "Error al enviar el voucher", error);
  }
};

export const getVouchers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let query = db.select().from(paymentVouchers);

    if (user.role === "client") {
      // @ts-ignore
      query = query.where(eq(paymentVouchers.clientId, user.id));
    } else if (user.role === "investor") {
      // @ts-ignore
      query = query.where(sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = ${paymentVouchers.loanId} AND loans.investor_id = ${user.id})`);
    }

    const results = await query.orderBy(desc(paymentVouchers.createdAt));
    sendSuccess(res, 200, "Vouchers obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener vouchers", error);
  }
};

export const processVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const validation = processVoucherSchema.safeParse(req.body);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const { action, observation } = validation.data;

    const [voucher] = await db.select().from(paymentVouchers).where(eq(paymentVouchers.id, id)).limit(1);
    if (!voucher) {
      sendError(res, 404, "Voucher no encontrado");
      return;
    }

    let nextStatus: any;

    if (user.role === "investor") {
      if (voucher.status !== "pending_investor_review") {
        sendError(res, 400, "El voucher no está pendiente de tu revisión");
        return;
      }
      nextStatus = action === "approve" ? "investor_approved" : "investor_rejected";
    } else if (user.role === "admin" || user.isOwner) {
      if (voucher.status !== "investor_approved" && voucher.status !== "pending_investor_review") {
        sendError(res, 400, "Estado no apto para validación final administrativa");
        return;
      }
      nextStatus = action === "approve" ? "owner_approved" : "owner_rejected";
    } else {
      sendError(res, 403, "No tienes permisos para procesar vouchers");
      return;
    }

    if (nextStatus === "owner_approved") {
      await processPaymentLogic({
        loanId: voucher.loanId,
        amount: voucher.amount,
        method: "transfer",
        registeredById: user.id,
        observation: `Voucher aprobado: ${observation || ""}`,
        reference: voucher.operationId,
        paymentDate: voucher.operationDate || undefined,
      });
    }

    const [updated] = await db.update(paymentVouchers)
      .set({
        status: nextStatus,
        observation,
        processedById: user.id,
        updatedAt: new Date(),
      })
      .where(eq(paymentVouchers.id, id))
      .returning();

    await logAudit({
      userId: user.id,
      action: `PROCESS_VOUCHER_${action.toUpperCase()}`,
      module: "VOUCHERS",
      entityId: id,
      newData: { status: nextStatus },
      req,
    });

    // NOTIFICACIÓN AL CLIENTE: Resultado del Voucher
    const isApproved = nextStatus === "owner_approved";
    await sendNotification({
      userId: voucher.clientId,
      title: isApproved ? "¡Pago Confirmado!" : "Voucher Rechazado",
      body: isApproved 
        ? `Tu pago por ${voucher.amount} ha sido validado exitosamente.`
        : `Tu voucher por ${voucher.amount} fue rechazado. Motivo: ${observation || "Sin especificar"}`,
      type: isApproved ? "VOUCHER_APPROVED" : "VOUCHER_REJECTED",
      data: { voucherId: id, loanId: voucher.loanId }
    });

    sendSuccess(res, 200, `Voucher actualizado a ${nextStatus}`, updated);
  } catch (error: any) {
    sendError(res, 500, error.message || "Error al procesar el voucher", error);
  }
};

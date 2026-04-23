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
import { uploadFile } from "../../utils/storage.util.js";

/**
 * Permite al cliente subir un comprobante de pago (voucher).
 * Acepta imagen como multipart/form-data en el campo "evidence".
 * Valida: duplicados de operationId, pertenencia del préstamo, y que el préstamo esté activo.
 */
export const submitVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = createVoucherSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const clientId = req.user!.id;
    const { loanId, operationId } = validation.data;

    // 1. Verificar duplicado de operationId
    const [existing] = await db.select()
      .from(paymentVouchers)
      .where(eq(paymentVouchers.operationId, operationId))
      .limit(1);
    
    if (existing) {
      sendError(res, 409, "Este ID de operación ya ha sido registrado previamente");
      return;
    }

    // 2. Verificar que el préstamo pertenece al cliente
    const [loan] = await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.clientId, clientId))).limit(1);
    if (!loan) {
      sendError(res, 403, "No tienes acceso a este préstamo");
      return;
    }

    // 3. Verificar que el préstamo esté activo
    if (loan.status !== "active") {
      sendError(res, 400, "Solo se pueden subir vouchers a préstamos activos");
      return;
    }

    // 4. Subir imagen al Storage si se adjuntó
    let evidenceUrl = validation.data.evidenceUrl || null;
    const file = req.file; // multer
    if (file) {
      evidenceUrl = await uploadFile(
        "vouchers",
        loanId,               // Subcarpeta: vouchers/{loanId}/
        file.buffer,
        file.originalname,
        file.mimetype,
      );
    }

    // 5. Determinar estado inicial
    const initialStatus = "pending_investor_review" as const;

    const [newVoucher] = await db.insert(paymentVouchers).values({
      ...validation.data,
      operationDate: validation.data.operationDate ? new Date(validation.data.operationDate) : new Date(),
      clientId,
      evidenceUrl,
      status: initialStatus,
    }).returning();

    await logAudit({
      userId: clientId,
      action: "SUBMIT_VOUCHER",
      module: "VOUCHERS",
      entityId: newVoucher.id,
      newData: newVoucher,
      req,
    });

    // 6. Notificar al inversionista si existe
    if (loan.investorId) {
      await sendNotification({
        userId: loan.investorId,
        title: "Nuevo voucher para revisar",
        body: `Un cliente ha subido un comprobante de pago por ${validation.data.amount}. Revísalo en tu panel.`,
        type: "VOUCHER_PENDING_REVIEW",
        data: { voucherId: newVoucher.id, loanId },
      });
    }

    sendSuccess(res, 201, "Voucher enviado para revisión", newVoucher);
  } catch (error) {
    sendError(res, 500, "Error al enviar el voucher", error);
  }
};

/**
 * Lista vouchers según el rol del usuario autenticado.
 * Filtros opcionales: ?status=..., ?loanId=..., ?from=..., ?to=...
 */
export const getVouchers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { status, loanId, from, to } = req.query;

    const conditions = [];

    // Filtrado por rol (obligatorio)
    if (user.role === "client") {
      conditions.push(eq(paymentVouchers.clientId, user.id));
    } else if (user.role === "investor") {
      conditions.push(sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = ${paymentVouchers.loanId} AND loans.investor_id = ${user.id})`);
    }

    // Filtros opcionales
    if (status) conditions.push(eq(paymentVouchers.status, status as typeof paymentVouchers.status.enumValues[number]));
    if (loanId) conditions.push(eq(paymentVouchers.loanId, loanId as string));
    if (from) conditions.push(sql`${paymentVouchers.createdAt} >= ${new Date(from as string)}`);
    if (to) conditions.push(sql`${paymentVouchers.createdAt} <= ${new Date(to as string)}`);

    let query = db.select().from(paymentVouchers);
    if (conditions.length > 0) {
      // @ts-ignore — dynamic conditions
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(paymentVouchers.createdAt));
    sendSuccess(res, 200, "Vouchers obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener vouchers", error);
  }
};

/**
 * Procesa un voucher (aprobar/rechazar).
 * Regla de negocio: Si el préstamo tiene inversionista, el inversionista DEBE aprobar antes que el Admin.
 * El Admin solo puede procesar directamente si el préstamo es fondeado por la empresa (sin inversionista).
 */
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

    // Obtener el préstamo para verificar si tiene inversionista
    const [loan] = await db.select().from(loans).where(eq(loans.id, voucher.loanId)).limit(1);

    let nextStatus: "draft" | "pending_investor_review" | "investor_approved" | "investor_rejected" | "owner_approved" | "owner_rejected";

    if (user.role === "investor") {
      // Inversionista: solo puede procesar vouchers en pending_investor_review
      if (voucher.status !== "pending_investor_review") {
        sendError(res, 400, "El voucher no está pendiente de tu revisión");
        return;
      }
      nextStatus = action === "approve" ? "investor_approved" : "investor_rejected";

    } else if (user.role === "admin" || user.isOwner) {
      // Admin/Dueño: la lógica depende de si el préstamo tiene inversionista
      const hasInvestor = loan && loan.investorId;

      if (hasInvestor) {
        // CON inversionista: el Admin solo puede actuar después de que el inversionista aprobó
        if (voucher.status !== "investor_approved") {
          sendError(res, 400, "El inversionista debe aprobar este voucher antes de la validación administrativa");
          return;
        }
      } else {
        // SIN inversionista (empresa): el Admin puede procesar directamente
        if (voucher.status !== "pending_investor_review" && voucher.status !== "investor_approved") {
          sendError(res, 400, "Estado no apto para validación administrativa");
          return;
        }
      }
      nextStatus = action === "approve" ? "owner_approved" : "owner_rejected";

    } else {
      sendError(res, 403, "No tienes permisos para procesar vouchers");
      return;
    }

    // Si es aprobación final, aplicar el pago al préstamo
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

    // Notificaciones según resultado
    // Al cliente: siempre
    const isApproved = nextStatus === "owner_approved";
    const isRejected = nextStatus === "investor_rejected" || nextStatus === "owner_rejected";

    if (isApproved || isRejected) {
      await sendNotification({
        userId: voucher.clientId,
        title: isApproved ? "¡Pago Confirmado!" : "Voucher Rechazado",
        body: isApproved
          ? `Tu pago por ${voucher.amount} ha sido validado exitosamente.`
          : `Tu voucher por ${voucher.amount} fue rechazado. Motivo: ${observation || "Sin especificar"}`,
        type: isApproved ? "VOUCHER_APPROVED" : "VOUCHER_REJECTED",
        data: { voucherId: id, loanId: voucher.loanId },
      });
    }

    // Al inversionista: cuando el Admin toma una decisión final
    if ((nextStatus === "owner_approved" || nextStatus === "owner_rejected") && loan?.investorId) {
      await sendNotification({
        userId: loan.investorId,
        title: isApproved ? "Pago confirmado por administración" : "Pago rechazado por administración",
        body: isApproved
          ? `El pago por ${voucher.amount} que aprobaste ha sido confirmado.`
          : `El pago por ${voucher.amount} fue rechazado por la administración.`,
        type: isApproved ? "VOUCHER_ADMIN_APPROVED" : "VOUCHER_ADMIN_REJECTED",
        data: { voucherId: id, loanId: voucher.loanId },
      });
    }

    sendSuccess(res, 200, `Voucher actualizado a ${nextStatus}`, updated);
  } catch (error: any) {
    sendError(res, 500, error.message || "Error al procesar el voucher", error);
  }
};

import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { loans } from "../../db/schema/loans.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { payments } from "../../db/schema/payments.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import { sendNotification } from "../../utils/notification.util.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import { resolveFileUrl, uploadFileStream } from "../../utils/storage.util.js";
import { processPaymentLogic, recalculateLoanLedger } from "../payments/payments.service.js";
import { createVoucherSchema, operationIdLookupSchema, processVoucherSchema, updateVoucherSchema } from "./payment-vouchers.schema.js";

const isUniqueViolation = (error: unknown): boolean => {
  return !!error && typeof error === "object" && "code" in error && error.code === "23505";
};

const attachSignedEvidenceUrl = async <T extends { evidenceUrl?: string | null }>(voucher: T): Promise<T> => {
  if (!voucher.evidenceUrl) {
    return voucher;
  }

  return {
    ...voucher,
    evidenceUrl: await resolveFileUrl(voucher.evidenceUrl),
  };
};

const normalizedOperationIdCondition = (operationId: string): SQL => {
  return sql`regexp_replace(upper(${paymentVouchers.operationId}), '[^A-Z0-9]', '', 'g') = ${operationId}`;
};

/**
 * Permite al cliente subir un comprobante de pago (voucher).
 * Acepta imagen como multipart/form-data en el campo "evidence".
 *
 * Implementación con Streaming Pass-Through:
 * - Los campos de texto se extraen del stream-parser (busboy) conforme llegan.
 * - La imagen se retransmite en tiempo real a Supabase Storage sin acumularse
 *   en RAM, reduciendo el uso de memoria a ~64KB por request y evitando timeouts
 *   del proxy Cloudflare al mantener actividad constante de red.
 * - Fallback: Si se recibe como JSON (sin multipart), usa el flujo legacy con multer.
 */
export const submitVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ── Fuente de datos: streaming (busboy) o legacy (multer/JSON) ──
    // Si la petición fue multipart, los campos vienen del stream-parser.
    // Si fue JSON (ej. tests o requests sin archivo), usar req.body.
    const streamParsed = req.streamParsed;
    const hasStreamFields = streamParsed && Object.keys(streamParsed.fields).length > 0;
    const bodySource = hasStreamFields ? streamParsed.fields : req.body;

    const validation = createVoucherSchema.safeParse(bodySource);
    if (!validation.success) {
      const futureOperationDateIssue = validation.error.issues.find(
        (issue) => issue.path.join(".") === "operationDate" && issue.message.includes("futura"),
      );

      sendError(
        res,
        400,
        futureOperationDateIssue?.message || "Datos inválidos",
        formatZodError(validation.error),
      );
      return;
    }

    const clientId = req.user!.id;
    const { loanId, operationId } = validation.data;

    // 1. Verificar duplicado de operationId
    const [existing] = await db.select()
      .from(paymentVouchers)
      .where(normalizedOperationIdCondition(operationId))
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
    if (loan.deletedAt || loan.status === "deleted") {
      sendError(res, 400, "No se pueden subir vouchers a préstamos eliminados");
      return;
    }

    if (loan.status !== "active") {
      sendError(res, 400, "Solo se pueden subir vouchers a préstamos activos");
      return;
    }

    // 4. Subir imagen al Storage — modo streaming o legacy
    let evidenceUrl = validation.data.evidenceUrl || null;

    if (streamParsed?.fileStream) {
      // ── Streaming Pass-Through: pipe directo a Supabase Storage ──
      // Los bytes fluyen: Cliente → Cloud Run → Supabase sin acumularse en RAM.
      evidenceUrl = await uploadFileStream(
        "vouchers",
        loanId,
        streamParsed.fileStream.stream,
        streamParsed.fileStream.generatedName,
        streamParsed.fileStream.mimetype,
      );
    }

    // 5. Determinar estado inicial
    const initialStatus = "pending_investor_review" as const;

    const [newVoucher] = await db.insert(paymentVouchers).values({
      ...validation.data,
      operationId,
      operationDate: validation.data.operationDate || new Date(),
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

    const responseVoucher = await attachSignedEvidenceUrl(newVoucher);
    sendSuccess(res, 201, "Voucher enviado para revisión", responseVoucher);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      sendError(res, 409, "Este ID de operación ya ha sido registrado previamente");
      return;
    }

    sendError(res, 500, "Error al enviar el voucher", error);
  }
};

export const checkOperationIdExists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = operationIdLookupSchema.safeParse(req.query);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const operationId = validation.data.operationId;

    const [existing] = await db
      .select({ id: paymentVouchers.id })
      .from(paymentVouchers)
      .where(normalizedOperationIdCondition(operationId))
      .limit(1);

    sendSuccess(res, 200, "ID de operación verificado", {
      operationId,
      exists: !!existing,
    });
  } catch (error) {
    sendError(res, 500, "Error al verificar el ID de operación", error);
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

    const conditions: SQL[] = [];

    // Filtrado por rol (obligatorio)
    if (user.role === "client") {
      conditions.push(eq(paymentVouchers.clientId, user.id));
    } else if (user.role === "investor") {
      conditions.push(sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = ${paymentVouchers.loanId} AND loans.investor_id = ${user.id})`);
    }

    conditions.push(sql`${paymentVouchers.deletedAt} IS NULL`);

    // Filtros opcionales
    if (status) conditions.push(eq(paymentVouchers.status, status as typeof paymentVouchers.status.enumValues[number]));
    if (loanId) conditions.push(eq(paymentVouchers.loanId, loanId as string));
    if (from) conditions.push(sql`${paymentVouchers.createdAt} >= ${new Date(from as string)}`);
    if (to) conditions.push(sql`${paymentVouchers.createdAt} <= ${new Date(to as string)}`);

    const results = await db
      .select()
      .from(paymentVouchers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(paymentVouchers.createdAt));
    const signedResults = await Promise.all(results.map((voucher) => attachSignedEvidenceUrl(voucher)));
    sendSuccess(res, 200, "Vouchers obtenidos", signedResults);
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
    if (!voucher || voucher.deletedAt || voucher.status === "deleted") {
      sendError(res, 404, "Voucher no encontrado");
      return;
    }

    // Obtener el préstamo para verificar si tiene inversionista
    const [loan] = await db.select().from(loans).where(eq(loans.id, voucher.loanId)).limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(res, 400, "No se puede procesar un voucher de un préstamo eliminado");
      return;
    }

    let nextStatus: "draft" | "pending_investor_review" | "investor_approved" | "investor_rejected" | "owner_approved" | "owner_rejected";

    if (user.role === "investor") {
      // Inversionista: solo puede procesar vouchers en pending_investor_review
      if (voucher.status !== "pending_investor_review") {
        sendError(res, 400, "El voucher no está pendiente de tu revisión");
        return;
      }
      if (!loan || loan.investorId !== user.id) {
        sendError(res, 403, "No estás asignado al préstamo de este voucher");
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
        voucherId: voucher.id,
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

    const responseVoucher = await attachSignedEvidenceUrl(updated);
    sendSuccess(res, 200, `Voucher actualizado a ${nextStatus}`, responseVoucher);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al procesar el voucher";
    sendError(res, 500, message, error);
  }
};

export const updateVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const validation = updateVoucherSchema.safeParse(req.body);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [voucher] = await db.select().from(paymentVouchers).where(eq(paymentVouchers.id, id)).limit(1);
    if (!voucher || voucher.deletedAt || voucher.status === "deleted") {
      sendError(res, 404, "Voucher no encontrado");
      return;
    }

    const [loan] = await db.select().from(loans).where(eq(loans.id, voucher.loanId)).limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(res, 400, "No se puede editar un voucher de un préstamo eliminado");
      return;
    }

    const canEditPending = user.role === "client"
      && voucher.clientId === user.id
      && ["draft", "pending_investor_review"].includes(voucher.status);
    const canEditApplied = (user.role === "admin" || user.isOwner)
      && voucher.status === "owner_approved";

    if (!canEditPending && !canEditApplied) {
      sendError(res, 403, "No tienes permiso para editar este voucher en su estado actual");
      return;
    }

    const [updatedVoucher] = await db.update(paymentVouchers)
      .set({
        ...validation.data,
        operationDate: validation.data.operationDate || undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentVouchers.id, id))
      .returning();

    let recalculated = null;
    if (canEditApplied) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.voucherId, voucher.id))
        .limit(1);

      if (payment && !payment.deletedAt) {
        await db.update(payments)
          .set({
            amount: updatedVoucher.amount,
            paymentDate: updatedVoucher.operationDate || payment.paymentDate,
            reference: updatedVoucher.operationId,
            observation: updatedVoucher.observation,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
        recalculated = await recalculateLoanLedger(voucher.loanId);
      }
    }

    await logAudit({
      userId: user.id,
      action: "UPDATE_VOUCHER",
      module: "VOUCHERS",
      entityId: id,
      oldData: voucher,
      newData: updatedVoucher,
      req,
    });

    const responseVoucher = await attachSignedEvidenceUrl(updatedVoucher);
    sendSuccess(res, 200, "Voucher actualizado correctamente", {
      voucher: responseVoucher,
      recalculation: recalculated,
    });
  } catch (error) {
    sendError(res, 500, "Error al actualizar voucher", error);
  }
};

export const deleteVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const [voucher] = await db.select().from(paymentVouchers).where(eq(paymentVouchers.id, id)).limit(1);
    if (!voucher || voucher.deletedAt || voucher.status === "deleted") {
      sendError(res, 404, "Voucher no encontrado");
      return;
    }

    const canDeletePending = user.role === "client"
      && voucher.clientId === user.id
      && ["draft", "pending_investor_review"].includes(voucher.status);
    const canDeleteAny = user.role === "admin" || user.isOwner;

    if (!canDeletePending && !canDeleteAny) {
      sendError(res, 403, "No tienes permiso para eliminar este voucher");
      return;
    }

    const [deletedVoucher] = await db.update(paymentVouchers)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentVouchers.id, id))
      .returning();

    let recalculated = null;
    if (voucher.status === "owner_approved") {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.voucherId, voucher.id))
        .limit(1);

      if (payment && !payment.deletedAt) {
        await db.update(payments)
          .set({
            status: "reversed",
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
        recalculated = await recalculateLoanLedger(voucher.loanId);
      }
    }

    await logAudit({
      userId: user.id,
      action: "DELETE_VOUCHER",
      module: "VOUCHERS",
      entityId: id,
      oldData: voucher,
      newData: deletedVoucher,
      req,
    });

    sendSuccess(res, 200, "Voucher eliminado correctamente", {
      voucher: deletedVoucher,
      recalculation: recalculated,
    });
  } catch (error) {
    sendError(res, 500, "Error al eliminar voucher", error);
  }
};

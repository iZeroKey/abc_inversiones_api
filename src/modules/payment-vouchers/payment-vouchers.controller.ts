import { randomUUID } from "crypto";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { Response } from "express";
import path from "path";
import { db } from "../../config/db.js";
import { loans } from "../../db/schema/loans.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { payments } from "../../db/schema/payments.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import { sendNotification } from "../../utils/notification.util.js";
import { emitLoanDomainEvent } from "../../utils/realtime.util.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import { 
  attachSignedUrls, 
  parseStorageReference, 
  moveStorageFile, 
  deleteStorageReference 
} from "../../utils/storage.util.js";
import { PaginationParamsMax } from "../../utils/validation.util.js";
import {
  PaymentBusinessError,
  processPaymentLogicInTransaction,
  recalculateLoanLedgerInTransaction,
} from "../payments/payments.service.js";
import {
  createVoucherSchema,
  operationIdLookupSchema,
  processVoucherSchema,
  updateVoucherSchema,
} from "./payment-vouchers.schema.js";

const isUniqueViolation = (error: unknown): boolean => {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  );
};

const normalizedOperationIdCondition = (operationId: string): SQL => {
  return sql`regexp_replace(upper(${paymentVouchers.operationId}), '[^A-Z0-9]', '', 'g') = ${operationId}`;
};

const voucherPendingStatuses = [
  "draft",
  "pending_investor_review",
  "pending_admin_review",
];

const voucherNeedsInvestorReview = async (
  investorId?: string | null,
): Promise<boolean> => {
  if (!investorId) {
    return false;
  }

  const [investor] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, investorId),
        eq(users.role, "investor"),
        eq(users.active, true),
        sql`${users.authUserId} IS NOT NULL`,
        sql`${users.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  return !!investor;
};

/**
 * Permite al cliente subir un comprobante de pago (voucher).
 * Acepta imagen como multipart/form-data en el campo "evidence".
 *
 * Implementación con busboy y buffer acotado:
 * - Los campos de texto se extraen del stream-parser (busboy) conforme llegan.
 * - La imagen se mantiene en memoria con límite estricto antes de subirla a
 *   Supabase Storage. El límite actual es pequeño (5MB) y evita deadlocks por
 *   backpressure entre busboy y el SDK de Storage.
 * - Fallback: Si se recibe como JSON (sin multipart), usa el flujo legacy con multer.
 */
export const submitVoucher = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  let uploadedFinalUrl: string | null = null;
  try {
    // Fuente de datos: multipart (busboy) o JSON.
    // Si la petición fue multipart, los campos vienen del parser.
    // Si fue JSON (ej. tests o requests sin archivo), usar req.body.
    const streamParsed = req.streamParsed;
    const hasStreamFields =
      streamParsed && Object.keys(streamParsed.fields).length > 0;
    const bodySource = hasStreamFields ? streamParsed.fields : req.body;

    const validation = createVoucherSchema.safeParse(bodySource);
    if (!validation.success) {
      const futureOperationDateIssue = validation.error.issues.find(
        (issue) =>
          issue.path.join(".") === "operationDate" &&
          issue.message.includes("futura"),
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
    
    // Capturamos el evidenceUrl en este scope para que si hay error podamos borrarlo
    let evidenceUrl = validation.data.evidenceUrl || null;

    // 1. Verificar duplicado de operationId
    const [existing] = await db
      .select()
      .from(paymentVouchers)
      .where(normalizedOperationIdCondition(operationId))
      .limit(1);

    if (existing) {
      sendError(
        res,
        409,
        "Este ID de operación ya ha sido registrado previamente",
      );
      return;
    }

    // 2. Verificar que el préstamo pertenece al cliente
    const [loan] = await db
      .select()
      .from(loans)
      .where(and(eq(loans.id, loanId), eq(loans.clientId, clientId)))
      .limit(1);
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

    // 4. Subir imagen al Storage
    if (streamParsed?.fileStream) {
      evidenceUrl = await streamParsed.fileStream.uploadPromise;
      
      const parsed = parseStorageReference(evidenceUrl);
      if (parsed && parsed.path.startsWith("temp/")) {
        const ext = path.extname(parsed.path) || ".jpg";
        const finalPath = `receipts/${loanId}/${randomUUID()}${ext}`;
        evidenceUrl = await moveStorageFile(parsed.bucket, parsed.path, finalPath);
        uploadedFinalUrl = evidenceUrl;
      }
    }

    // 5. Determinar estado inicial según si el inversionista puede revisar.
    const initialStatus = (await voucherNeedsInvestorReview(loan.investorId))
      ? "pending_investor_review"
      : "pending_admin_review";

    const [newVoucher] = await db
      .insert(paymentVouchers)
      .values({
        ...validation.data,
        operationId,
        operationDate: validation.data.operationDate || new Date(),
        clientId,
        evidenceUrl,
        status: initialStatus,
      })
      .returning();

    await logAudit({
      userId: clientId,
      action: "SUBMIT_VOUCHER",
      module: "VOUCHERS",
      entityId: newVoucher.id,
      newData: newVoucher,
      req,
    });

    // 6. Notificar al inversionista solo si tiene acceso operativo.
    if (initialStatus === "pending_investor_review" && loan.investorId) {
      await sendNotification({
        userId: loan.investorId,
        title: "Nuevo voucher para revisar",
        body: `Un cliente ha subido un comprobante de pago por ${validation.data.amount}. Revísalo en tu panel.`,
        type: "VOUCHER_PENDING_REVIEW",
        data: { voucherId: newVoucher.id, loanId },
      });
    }

    const [responseVoucher] = await attachSignedUrls([newVoucher]);
    emitLoanDomainEvent("voucher.created", {
      loanId: newVoucher.loanId,
      voucherId: newVoucher.id,
      clientId: newVoucher.clientId,
      investorId: loan.investorId,
      status: newVoucher.status,
    });
    sendSuccess(res, 201, "Voucher enviado para revisión", responseVoucher);
  } catch (error: unknown) {
    if (uploadedFinalUrl) {
      await deleteStorageReference(uploadedFinalUrl).catch(console.error);
    } else if (req.streamParsed?.fileStream) {
      const uploadedUrl = await req.streamParsed.fileStream.uploadPromise.catch(() => null);
      if (uploadedUrl) {
         await deleteStorageReference(uploadedUrl).catch(console.error);
      }
    }

    if (isUniqueViolation(error)) {
      sendError(
        res,
        409,
        "Este ID de operación ya ha sido registrado previamente",
      );
      return;
    }

    sendError(res, 500, "Error al enviar el voucher", error);
  }
};

export const checkOperationIdExists = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
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
export const getVouchers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;

    const params = PaginationParamsMax(100).safeParse(req.query);
    if (!params.success) {
      sendError(res, 400, "Parámetros inválidos", formatZodError(params.error));
      return;
    }
    const { page, limit } = params.data;
    const offset = (page - 1) * limit;

    const { status, loanId, from, to, q } = req.query;

    const conditions: SQL[] = [];

    if (user.role === "client") {
      conditions.push(eq(paymentVouchers.clientId, user.id));
    } else if (user.role === "investor") {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = ${paymentVouchers.loanId} AND loans.investor_id = ${user.id})`,
      );
    }

    conditions.push(sql`${paymentVouchers.deletedAt} IS NULL`);

    if (status)
      conditions.push(
        eq(
          paymentVouchers.status,
          status as (typeof paymentVouchers.status.enumValues)[number],
        ),
      );
    if (loanId) conditions.push(eq(paymentVouchers.loanId, loanId as string));
    if (from)
      conditions.push(
        sql`${paymentVouchers.createdAt} >= ${new Date(from as string)}`,
      );
    if (to)
      conditions.push(
        sql`${paymentVouchers.createdAt} <= ${new Date(to as string)}`,
      );
    if (q && typeof q === "string" && q.trim()) {
      conditions.push(
        sql`${paymentVouchers.operationId} ILIKE ${`%${q.trim()}%`}`,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(paymentVouchers)
      .where(where);

    const total = countRow?.total ?? 0;

    const results = await db
      .select()
      .from(paymentVouchers)
      .where(where)
      .orderBy(desc(paymentVouchers.createdAt))
      .limit(limit)
      .offset(offset);

    const signedResults = await attachSignedUrls(results);

    sendSuccess(res, 200, "Vouchers obtenidos", signedResults, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener vouchers", error);
  }
};

/**
 * Procesa un voucher (aprobar/rechazar).
 * Regla de negocio: Si el préstamo tiene inversionista, el inversionista DEBE aprobar antes que el Admin.
 * El Admin solo puede procesar directamente si el préstamo es fondeado por la empresa (sin inversionista).
 */
export const processVoucher = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const validation = processVoucherSchema.safeParse(req.body);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const { action, observation } = validation.data;

    const [voucher] = await db
      .select()
      .from(paymentVouchers)
      .where(eq(paymentVouchers.id, id))
      .limit(1);
    if (!voucher || voucher.deletedAt || voucher.status === "deleted") {
      sendError(res, 404, "Voucher no encontrado");
      return;
    }

    // Obtener el préstamo para verificar si tiene inversionista
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, voucher.loanId))
      .limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(
        res,
        400,
        "No se puede procesar un voucher de un préstamo eliminado",
      );
      return;
    }

    const needsInvestorReview = await voucherNeedsInvestorReview(
      loan.investorId,
    );
    let nextStatus: (typeof paymentVouchers.status.enumValues)[number];
    let appliedPaymentId: string | null = null;

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
      nextStatus =
        action === "approve" ? "investor_approved" : "investor_rejected";
    } else if (user.role === "admin" || user.isOwner) {
      // Admin/Dueño: la lógica depende de si el inversionista puede revisar.
      if (needsInvestorReview) {
        // CON inversionista: el Admin solo puede actuar después de que el inversionista aprobó
        if (voucher.status !== "investor_approved") {
          sendError(
            res,
            400,
            "El inversionista debe aprobar este voucher antes de la validación administrativa",
          );
          return;
        }
      } else {
        // SIN inversionista con acceso: el Admin puede procesar directamente
        if (
          ![
            "pending_admin_review",
            "pending_investor_review",
            "investor_approved",
          ].includes(voucher.status)
        ) {
          sendError(res, 400, "Estado no apto para validación administrativa");
          return;
        }
      }
      nextStatus = action === "approve" ? "owner_approved" : "owner_rejected";
    } else {
      sendError(res, 403, "No tienes permisos para procesar vouchers");
      return;
    }

    const { updated, paymentId } = await db.transaction(async (tx) => {
      let paymentId: string | null = null;

      if (nextStatus === "owner_approved") {
        const appliedPayment = await processPaymentLogicInTransaction(tx, {
          loanId: voucher.loanId,
          amount: voucher.amount,
          method: "transfer",
          registeredById: user.id,
          voucherId: voucher.id,
          observation: `Voucher aprobado: ${observation || ""}`,
          reference: voucher.operationId,
          paymentDate: voucher.operationDate || undefined,
          evidenceUrl: voucher.evidenceUrl,
        });
        paymentId = appliedPayment.id;
      }

      const [updated] = await tx
        .update(paymentVouchers)
        .set({
          status: nextStatus,
          observation,
          processedById: user.id,
          updatedAt: new Date(),
        })
        .where(eq(paymentVouchers.id, id))
        .returning();

      if (!updated) {
        throw new Error("No se pudo actualizar el voucher");
      }

      return { updated, paymentId };
    });
    appliedPaymentId = paymentId;

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
    const isRejected =
      nextStatus === "investor_rejected" || nextStatus === "owner_rejected";

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
    if (
      (nextStatus === "owner_approved" || nextStatus === "owner_rejected") &&
      loan?.investorId
    ) {
      await sendNotification({
        userId: loan.investorId,
        title: isApproved
          ? "Pago confirmado por administración"
          : "Pago rechazado por administración",
        body: isApproved
          ? `El pago por ${voucher.amount} que aprobaste ha sido confirmado.`
          : `El pago por ${voucher.amount} fue rechazado por la administración.`,
        type: isApproved ? "VOUCHER_ADMIN_APPROVED" : "VOUCHER_ADMIN_REJECTED",
        data: { voucherId: id, loanId: voucher.loanId },
      });
    }

    const [responseVoucher] = await attachSignedUrls([updated]);
    emitLoanDomainEvent("voucher.updated", {
      loanId: updated.loanId,
      voucherId: updated.id,
      paymentId: appliedPaymentId,
      clientId: updated.clientId,
      investorId: loan.investorId,
      status: updated.status,
    });

    if (appliedPaymentId) {
      emitLoanDomainEvent("payment.created", {
        loanId: updated.loanId,
        paymentId: appliedPaymentId,
        clientId: updated.clientId,
        investorId: loan.investorId,
      });
    }

    sendSuccess(
      res,
      200,
      `Voucher actualizado a ${nextStatus}`,
      responseVoucher,
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error al procesar el voucher";
    const status =
      error instanceof PaymentBusinessError ? error.statusCode : 500;
    sendError(res, status, message, error);
  }
};

export const updateVoucher = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const validation = updateVoucherSchema.safeParse(req.body);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [voucher] = await db
      .select()
      .from(paymentVouchers)
      .where(eq(paymentVouchers.id, id))
      .limit(1);
    if (!voucher || voucher.deletedAt || voucher.status === "deleted") {
      sendError(res, 404, "Voucher no encontrado");
      return;
    }

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, voucher.loanId))
      .limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(
        res,
        400,
        "No se puede editar un voucher de un préstamo eliminado",
      );
      return;
    }

    const canEditPending =
      user.role === "client" &&
      voucher.clientId === user.id &&
      voucherPendingStatuses.includes(voucher.status);
    const canEditApplied =
      (user.role === "admin" || user.isOwner) &&
      voucher.status === "owner_approved";

    if (!canEditPending && !canEditApplied) {
      sendError(
        res,
        403,
        "No tienes permiso para editar este voucher en su estado actual",
      );
      return;
    }

    const [updatedVoucher] = await db
      .update(paymentVouchers)
      .set({
        ...validation.data,
        operationDate: validation.data.operationDate || undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentVouchers.id, id))
      .returning();

    let recalculated = null;
    let relatedPaymentId: string | null = null;
    if (canEditApplied) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.voucherId, voucher.id))
        .limit(1);

      if (payment && !payment.deletedAt) {
        relatedPaymentId = payment.id;
        recalculated = await db.transaction(async (tx) => {
          await tx
            .update(payments)
            .set({
              amount: updatedVoucher.amount,
              paymentDate: updatedVoucher.operationDate || payment.paymentDate,
              reference: updatedVoucher.operationId,
              observation: updatedVoucher.observation,
              updatedAt: new Date(),
            })
            .where(eq(payments.id, payment.id));
          return await recalculateLoanLedgerInTransaction(tx, voucher.loanId);
        });
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

    const [responseVoucher] = await attachSignedUrls([updatedVoucher]);
    emitLoanDomainEvent("voucher.updated", {
      loanId: updatedVoucher.loanId,
      voucherId: updatedVoucher.id,
      paymentId: relatedPaymentId,
      clientId: updatedVoucher.clientId,
      investorId: loan.investorId,
      status: updatedVoucher.status,
    });

    if (relatedPaymentId) {
      emitLoanDomainEvent("payment.updated", {
        loanId: updatedVoucher.loanId,
        paymentId: relatedPaymentId,
        clientId: updatedVoucher.clientId,
        investorId: loan.investorId,
      });
    }

    sendSuccess(res, 200, "Voucher actualizado correctamente", {
      voucher: responseVoucher,
      recalculation: recalculated,
    });
  } catch (error) {
    sendError(res, 500, "Error al actualizar voucher", error);
  }
};

export const deleteVoucher = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const [voucher] = await db
      .select()
      .from(paymentVouchers)
      .where(eq(paymentVouchers.id, id))
      .limit(1);
    if (!voucher || voucher.deletedAt || voucher.status === "deleted") {
      sendError(res, 404, "Voucher no encontrado");
      return;
    }

    const [loan] = await db
      .select({ investorId: loans.investorId })
      .from(loans)
      .where(eq(loans.id, voucher.loanId))
      .limit(1);

    const canDeletePending =
      user.role === "client" &&
      voucher.clientId === user.id &&
      voucherPendingStatuses.includes(voucher.status);
    const canDeleteAny = user.role === "admin" || user.isOwner;

    if (!canDeletePending && !canDeleteAny) {
      sendError(res, 403, "No tienes permiso para eliminar este voucher");
      return;
    }

    const [deletedVoucher] = await db
      .update(paymentVouchers)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentVouchers.id, id))
      .returning();

    // Eliminar archivo de storage (usar el valor original, no el del RETURNING)
    if (voucher.evidenceUrl) {
      await deleteStorageReference(voucher.evidenceUrl).catch(console.error);
      await db.update(paymentVouchers)
        .set({ evidenceUrl: null })
        .where(eq(paymentVouchers.id, id));
      deletedVoucher.evidenceUrl = null;
    }

    let recalculated = null;
    let relatedPaymentId: string | null = null;
    if (voucher.status === "owner_approved") {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.voucherId, voucher.id))
        .limit(1);

      if (payment && !payment.deletedAt) {
        relatedPaymentId = payment.id;
        recalculated = await db.transaction(async (tx) => {
          await tx
            .update(payments)
            .set({
              status: "reversed",
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(payments.id, payment.id));
          return await recalculateLoanLedgerInTransaction(tx, voucher.loanId);
        });
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

    emitLoanDomainEvent("voucher.deleted", {
      loanId: deletedVoucher.loanId,
      voucherId: deletedVoucher.id,
      paymentId: relatedPaymentId,
      clientId: deletedVoucher.clientId,
      investorId: loan?.investorId,
      status: deletedVoucher.status,
    });

    if (relatedPaymentId) {
      emitLoanDomainEvent("payment.deleted", {
        loanId: deletedVoucher.loanId,
        paymentId: relatedPaymentId,
        clientId: deletedVoucher.clientId,
        investorId: loan?.investorId,
      });
    }

    sendSuccess(res, 200, "Voucher eliminado correctamente", {
      voucher: deletedVoucher,
      recalculation: recalculated,
    });
  } catch (error) {
    sendError(res, 500, "Error al eliminar voucher", error);
  }
};

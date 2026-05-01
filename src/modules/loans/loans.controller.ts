import { and, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import { Response } from "express";
import { DateTime } from "luxon";
import { db } from "../../config/db.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import { sendNotification } from "../../utils/notification.util.js";
import {
    formatZodError,
    sendError,
    sendSuccess,
} from "../../utils/response.util.js";
import { createLoanSchema, rejectLoanSchema } from "./loans.schema.js";

const calculateTotalDebt = (
  principal: number,
  rate: number,
  count: number,
  type: "simple" | "compound",
  period: "monthly" | "annual",
): number => {
  void period;

  if (type === "simple") {
    return principal + principal * (rate / 100) * count;
  } else {
    return principal * Math.pow(1 + rate / 100, count);
  }
};

const canAccessLoan = (user: AuthRequest["user"], loan: typeof loans.$inferSelect): boolean => {
  if (!user) return false;
  if (user.role === "admin" || user.isOwner) return true;
  if (user.role === "client") return loan.clientId === user.id;
  if (user.role === "investor") return loan.investorId === user.id;
  return false;
};

export const createLoan = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const validation = createLoanSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const data = validation.data;
    const principal = Number(data.principal);
    const rate = Number(data.interestRate);

    const totalDebt = calculateTotalDebt(
      principal,
      rate,
      data.installmentsCount,
      data.interestType,
      data.interestPeriod,
    );

    const hasInvestor = !!data.investorId;
    const initialStatus = hasInvestor
      ? "pending_investor_review"
      : "pending_admin_review";

    const [newLoan] = await db
      .insert(loans)
      .values({
        ...data,
        principal: principal.toString(),
        interestRate: rate.toString(),
        totalDebt: totalDebt.toFixed(2),
        status: initialStatus,
        isCompanyFunded: !hasInvestor,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
      })
      .returning();

    await logAudit({
      userId: req.user!.id,
      action: "CREATE_LOAN",
      module: "LOANS",
      entityId: newLoan.id,
      newData: newLoan,
      req,
    });

    await sendNotification({
      userId: newLoan.clientId,
      title: "Solicitud de préstamo enviada",
      body: `Tu solicitud de préstamo por ${principal} ha sido enviada para revisión.`,
      type: "LOAN_SUBMITTED",
      data: { loanId: newLoan.id }
    });

    sendSuccess(res, 201, "Préstamo creado y enviado a revisión", newLoan);
  } catch (error) {
    sendError(res, 500, "Error al crear el préstamo", error);
  }
};

export const getAllLoans = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;
    const { status, clientId, investorId, from, to } = req.query;

    const conditions: SQL[] = [];

    // Filtrado por rol (obligatorio)
    if (user.role === "client") {
      conditions.push(eq(loans.clientId, user.id));
    } else if (user.role === "investor") {
      conditions.push(eq(loans.investorId, user.id));
    }

    // Filtros opcionales (admin/investor pueden filtrar más)
    if (status) conditions.push(eq(loans.status, status as typeof loans.status.enumValues[number]));
    if (clientId && user.role !== "client") conditions.push(eq(loans.clientId, clientId as string));
    if (investorId && user.role !== "investor") conditions.push(eq(loans.investorId, investorId as string));
    if (from) conditions.push(sql`${loans.createdAt} >= ${new Date(from as string)}`);
    if (to) conditions.push(sql`${loans.createdAt} <= ${new Date(to as string)}`);

    const results = await db
      .select()
      .from(loans)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(loans.createdAt));
    sendSuccess(res, 200, "Préstamos obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener préstamos", error);
  }
};

export const getLoanById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!loan) {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    if (!canAccessLoan(user, loan)) {
      sendError(res, 403, "No tienes acceso a este préstamo");
      return;
    }

    sendSuccess(res, 200, "Detalle de préstamo obtenido", loan);
  } catch (error) {
    sendError(res, 500, "Error al obtener detalle del préstamo", error);
  }
};

export const getLoanInstallments = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const loanId = req.params.id as string;
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

    if (!canAccessLoan(user, loan)) {
      sendError(res, 403, "No tienes acceso al cronograma de este préstamo");
      return;
    }

    const results = await db
      .select()
      .from(installments)
      .where(eq(installments.loanId, loanId))
      .orderBy(installments.installmentNumber);

    sendSuccess(res, 200, "Cronograma obtenido", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener cronograma", error);
  }
};

export const getSummary = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;
    const now = new Date();

    if (user.role === "client") {
      const [stats] = await db
        .select({
          totalPrincipal: sql<string>`sum(${loans.principal})`,
          totalDebt: sql<string>`sum(${loans.totalDebt})`,
        })
        .from(loans)
        .where(eq(loans.clientId, user.id));

      const [nextPayment] = await db
        .select()
        .from(installments)
        .innerJoin(loans, eq(loans.id, installments.loanId))
        .where(
          and(eq(loans.clientId, user.id), eq(installments.status, "pending")),
        )
        .orderBy(installments.dueDate)
        .limit(1);

      sendSuccess(res, 200, "Resumen de cuenta cliente", {
        stats,
        nextPayment: nextPayment
          ? {
              date: nextPayment.installments.dueDate,
              amount: nextPayment.installments.amount,
            }
          : null,
      });
    } else if (user.role === "investor") {
      const [stats] = await db
        .select({
          investedAmount: sql<string>`sum(${loans.principal})`,
          expectedRevenue: sql<string>`sum(${loans.totalDebt})`,
        })
        .from(loans)
        .where(and(eq(loans.investorId, user.id), eq(loans.status, "active")));

      const [overdueStats] = await db
        .select({
          overdueCount: sql<number>`count(*)`,
          overdueAmount: sql<string>`sum(${installments.amount} - ${installments.paidAmount})`,
        })
        .from(installments)
        .innerJoin(loans, eq(loans.id, installments.loanId))
        .where(
          and(
            eq(loans.investorId, user.id),
            eq(installments.status, "pending"),
            lt(installments.dueDate, now),
          ),
        );

      sendSuccess(res, 200, "Resumen de inversiones", {
        ...stats,
        overdue: overdueStats || { overdueCount: 0, overdueAmount: "0" },
      });
    } else {
      const [stats] = await db
        .select({
          totalActiveLoans: sql<number>`count(*)`,
          totalPortfolio: sql<string>`sum(${loans.principal})`,
          overdueGlobal: sql<string>`sum(CASE WHEN ${installments.dueDate} < ${now} AND ${installments.status} = 'pending' THEN ${installments.amount} - ${installments.paidAmount} ELSE 0 END)`,
        })
        .from(loans)
        .leftJoin(installments, eq(loans.id, installments.loanId))
        .where(eq(loans.status, "active"));

      sendSuccess(res, 200, "Dashboard administrativo", stats);
    }
  } catch (error) {
    sendError(res, 500, "Error al obtener resumen", error);
  }
};

export const approveLoan = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!loan) {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    if (user.role === "investor" && loan.status === "pending_investor_review") {
      if (loan.investorId !== user.id) {
        sendError(res, 403, "No estás asignado a este préstamo");
        return;
      }
      const [updated] = await db
        .update(loans)
        .set({ status: "pending_admin_review", updatedAt: new Date() })
        .where(eq(loans.id, id))
        .returning();

      await logAudit({
        userId: user.id,
        action: "INVESTOR_APPROVE_LOAN",
        module: "LOANS",
        entityId: id,
        req,
      });

      await sendNotification({
        userId: loan.clientId,
        title: "Avance en tu préstamo",
        body: "Tu préstamo ha sido aprobado por el inversionista y está en revisión final por el Admin.",
        type: "LOAN_INVESTOR_APPROVED",
        data: { loanId: id }
      });

      sendSuccess(
        res,
        200,
        "Préstamo aprobado por inversionista. Pendiente de Admin.",
        updated,
      );
      return;
    }

    if (
      (user.role === "admin" || user.isOwner) &&
      loan.status === "pending_admin_review"
    ) {
      const installmentsList = [];
      const amountPerInstallment =
        Number(loan.totalDebt) / loan.installmentsCount;
      let currentDate = DateTime.fromJSDate(loan.startDate || new Date());

      for (let i = 1; i <= loan.installmentsCount; i++) {
        if (loan.frequency === "monthly") {
          currentDate = currentDate.plus({ months: 1 });
          if (loan.paymentDay) {
            currentDate = currentDate.set({ day: loan.paymentDay });
          }
        } else if (loan.frequency === "biweekly") {
          currentDate = currentDate.plus({ weeks: 2 });
        } else if (loan.frequency === "weekly") {
          currentDate = currentDate.plus({ weeks: 1 });
        } else {
          currentDate = currentDate.plus({ days: 1 });
        }

        installmentsList.push({
          loanId: loan.id,
          installmentNumber: i,
          dueDate: currentDate.toJSDate(),
          amount: amountPerInstallment.toFixed(2),
          status: "pending" as const,
        });
      }

      await db.insert(installments).values(installmentsList);

      const [updated] = await db
        .update(loans)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(loans.id, id))
        .returning();

      await logAudit({
        userId: user.id,
        action: "ADMIN_APPROVE_LOAN",
        module: "LOANS",
        entityId: id,
        newData: { status: "active" },
        req,
      });

      await sendNotification({
        userId: loan.clientId,
        title: "¡Préstamo Aprobado!",
        body: `Tu préstamo ha sido activado. Ya puedes revisar tu cronograma de pagos.`,
        type: "LOAN_ACTIVE",
        data: { loanId: id }
      });

      // Notificar al inversionista si existe
      if (loan.investorId) {
        await sendNotification({
          userId: loan.investorId,
          title: "Préstamo activado",
          body: `El préstamo que aprobaste ha sido activado por la administración.`,
          type: "LOAN_ACTIVE_INVESTOR",
          data: { loanId: id }
        });
      }

      sendSuccess(res, 200, "Préstamo activado y cuotas generadas", {
        loan: updated,
        installments: installmentsList,
      });
      return;
    }

    sendError(res, 400, "No tienes permisos para aprobar en este estado");
  } catch (error) {
    sendError(res, 500, "Error al aprobar el préstamo", error);
  }
};

/**
 * Rechazar un préstamo.
 * Solo Admin/Dueño o el Inversionista asignado pueden rechazar.
 */
export const rejectLoan = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const validation = rejectLoanSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const { observation } = validation.data;

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!loan) {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    // Solo se pueden rechazar préstamos en estado de revisión
    const rejectableStatuses = ["pending_investor_review", "pending_admin_review"];
    if (!rejectableStatuses.includes(loan.status)) {
      sendError(res, 400, "Este préstamo no puede ser rechazado en su estado actual");
      return;
    }

    // Validar permisos según rol
    if (user.role === "investor") {
      if (loan.status !== "pending_investor_review" || loan.investorId !== user.id) {
        sendError(res, 403, "No tienes permisos para rechazar este préstamo");
        return;
      }
    } else if (user.role !== "admin" && !user.isOwner) {
      sendError(res, 403, "No tienes permisos para rechazar préstamos");
      return;
    }

    const [updated] = await db
      .update(loans)
      .set({
        status: "rejected",
        observation: observation || null,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, id))
      .returning();

    await logAudit({
      userId: user.id,
      action: "REJECT_LOAN",
      module: "LOANS",
      entityId: id,
      newData: { status: "rejected", observation },
      req,
    });

    // Notificar al cliente
    await sendNotification({
      userId: loan.clientId,
      title: "Préstamo Rechazado",
      body: `Tu solicitud de préstamo ha sido rechazada. ${observation ? `Motivo: ${observation}` : ""}`,
      type: "LOAN_REJECTED",
      data: { loanId: id },
    });

    sendSuccess(res, 200, "Préstamo rechazado", updated);
  } catch (error) {
    sendError(res, 500, "Error al rechazar el préstamo", error);
  }
};

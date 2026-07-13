import {
  and,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Response } from "express";
import { db } from "../../config/db.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { payments } from "../../db/schema/payments.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import { sendNotification } from "../../utils/notification.util.js";
import { generatePublicCode } from "../../utils/public-code.util.js";
import { emitLoanDomainEvent } from "../../utils/realtime.util.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import { attachSignedUrls } from "../../utils/storage.util.js";
import { PaginationParamsMax } from "../../utils/validation.util.js";
import { recalculateLoanLedger } from "../payments/payments.service.js";
import {
  buildInstallmentDrafts,
  calculateLoanFinancials,
} from "./loans.finance.js";
import {
  normalizeScheduleStartDate,
  type LoanFrequency,
} from "./loans.schedule.js";
import {
  createLoanSchema,
  rejectLoanSchema,
  updateLoanSchema,
} from "./loans.schema.js";

const canAccessLoan = (
  user: AuthRequest["user"],
  loan: typeof loans.$inferSelect,
): boolean => {
  if (!user) return false;
  if (user.role === "admin" || user.isOwner) return true;
  if (user.role === "client") return loan.clientId === user.id;
  if (user.role === "investor") return loan.investorId === user.id;
  return false;
};

const isAdminOrOwner = (user: AuthRequest["user"]): boolean =>
  !!user && (user.role === "admin" || user.isOwner);

const getActiveUserByRole = async (id: string, role: "client" | "investor") => {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, id),
        eq(users.role, role),
        eq(users.active, true),
        sql`${users.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  return user;
};

const clientUsers = alias(users, "client_users");
const investorUsers = alias(users, "investor_users");
const loanColumns = getTableColumns(loans);

const loanWithParticipantsSelection = {
  ...loanColumns,
  clientCode: clientUsers.publicCode,
  clientName: sql<string>`concat(${clientUsers.firstName}, ' ', ${clientUsers.lastName})`,
  investorCode: investorUsers.publicCode,
  investorName: sql<
    string | null
  >`CASE WHEN ${investorUsers.id} IS NULL THEN NULL ELSE concat(${investorUsers.firstName}, ' ', ${investorUsers.lastName}) END`,
  client: sql<Record<string, unknown>>`json_build_object(
    'id', ${clientUsers.id},
    'publicCode', ${clientUsers.publicCode},
    'firstName', ${clientUsers.firstName},
    'lastName', ${clientUsers.lastName},
    'avatarUrl', ${clientUsers.avatarUrl}
  )`,
  investor: sql<Record<string, unknown> | null>`CASE WHEN ${investorUsers.id} IS NULL THEN NULL ELSE json_build_object(
    'id', ${investorUsers.id},
    'publicCode', ${investorUsers.publicCode},
    'firstName', ${investorUsers.firstName},
    'lastName', ${investorUsers.lastName},
    'avatarUrl', ${investorUsers.avatarUrl}
  ) END`,
};

const getInstallmentAggregation = async (
  loanIds: string[],
): Promise<Map<string, Record<string, unknown>>> => {
  if (loanIds.length === 0) return new Map();
  const rows = await db.execute(sql`
    WITH loan_agg AS (
      SELECT
        i.loan_id,
        COALESCE(SUM(i.paid_amount)::numeric(12,2), 0) as total_paid,
        COALESCE(SUM(GREATEST(i.amount - i.paid_amount, 0))::numeric(12,2), 0) as remaining_debt,
        COUNT(*) FILTER (WHERE i.status <> 'paid')::int as remaining_installments,
        MIN(CASE WHEN i.status <> 'paid' THEN i.due_date END) as next_payment_date,
        json_build_object(
          'dueDate', MIN(CASE WHEN i.status <> 'paid' THEN i.due_date END),
          'amount', MIN(CASE WHEN i.status <> 'paid' THEN i.amount END)
        ) as next_installment
      FROM ${installments} i
      WHERE i.loan_id IN (${sql.join(loanIds, sql`, `)})
      GROUP BY i.loan_id
    )
    SELECT * FROM loan_agg
  `);
  return new Map(
    rows.map((r: Record<string, unknown>) => [r.loan_id as string, r]),
  );
};

const attachParticipantAvatars = async <T extends Record<string, unknown>>(loansData: T[]): Promise<T[]> => {
  const participants: Record<string, unknown>[] = [];
  for (const loan of loansData) {
    if (loan.client) participants.push(loan.client as Record<string, unknown>);
    if (loan.investor) participants.push(loan.investor as Record<string, unknown>);
  }
  if (participants.length === 0) return loansData;
  const signedParticipants = await attachSignedUrls(participants, "avatarUrl", "avatars");
  let pIdx = 0;
  return loansData.map((loan) => {
    const newLoan = { ...loan };
    if (newLoan.client) (newLoan as any).client = signedParticipants[pIdx++];
    if (newLoan.investor) (newLoan as any).investor = signedParticipants[pIdx++];
    return newLoan;
  });
};

const selectLoanWithParticipantsById = async (id: string) => {
  const [loan] = await db
    .select(loanWithParticipantsSelection)
    .from(loans)
    .innerJoin(clientUsers, eq(clientUsers.id, loans.clientId))
    .leftJoin(investorUsers, eq(investorUsers.id, loans.investorId))
    .where(eq(loans.id, id))
    .limit(1);

  if (!loan) return null;
  const [signedLoan] = await attachParticipantAvatars([loan]);
  return signedLoan;
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
    const client = await getActiveUserByRole(data.clientId, "client");
    if (!client) {
      sendError(res, 404, "Cliente no encontrado");
      return;
    }

    if (data.investorId) {
      const investor = await getActiveUserByRole(data.investorId, "investor");
      if (!investor) {
        sendError(res, 404, "Inversionista no encontrado");
        return;
      }
    }

    const principal = Number(data.principal);
    const rate = Number(data.interestRate);
    const { totalDebt } = calculateLoanFinancials({
      principal,
      interestRate: rate,
      installmentsCount: data.installmentsCount,
    });

    const hasInvestor = !!data.investorId;
    const initialStatus = hasInvestor
      ? "pending_investor_review"
      : "pending_admin_review";

    const publicCode = await generatePublicCode("loan");
    const name = data.name ?? `Préstamo #${publicCode}`;

    const [newLoan] = await db
      .insert(loans)
      .values({
        ...data,
        name,
        publicCode,
        principal: principal.toString(),
        interestRate: rate.toString(),
        totalDebt: totalDebt.toFixed(2),
        status: initialStatus,
        isCompanyFunded: !hasInvestor,
        startDate: new Date(data.startDate),
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
      data: { loanId: newLoan.id },
    });

    const responseLoan = await selectLoanWithParticipantsById(newLoan.id);
    emitLoanDomainEvent("loan.created", {
      loanId: newLoan.id,
      clientId: newLoan.clientId,
      investorId: newLoan.investorId,
      status: newLoan.status,
    });
    sendSuccess(
      res,
      201,
      "Préstamo creado y enviado a revisión",
      responseLoan || newLoan,
    );
  } catch (error) {
    sendError(res, 500, "Error al crear el préstamo", error);
  }
};

export const updateLoan = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;
    if (!isAdminOrOwner(user)) {
      sendError(res, 403, "No tienes permisos para editar préstamos");
      return;
    }

    const id = req.params.id as string;
    const validation = updateLoanSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [oldLoan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);
    if (!oldLoan || oldLoan.deletedAt || oldLoan.status === "deleted") {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    const data = validation.data;
    if (data.clientId) {
      const client = await getActiveUserByRole(data.clientId, "client");
      if (!client) {
        sendError(res, 404, "Cliente no encontrado");
        return;
      }
    }

    if (data.investorId) {
      const investor = await getActiveUserByRole(data.investorId, "investor");
      if (!investor) {
        sendError(res, 404, "Inversionista no encontrado");
        return;
      }
    }

    const principal =
      data.principal !== undefined
        ? Number(data.principal)
        : Number(oldLoan.principal);
    const interestRate =
      data.interestRate !== undefined
        ? Number(data.interestRate)
        : Number(oldLoan.interestRate);
    const installmentsCount =
      data.installmentsCount ?? oldLoan.installmentsCount;
    const financials = calculateLoanFinancials({
      principal,
      interestRate,
      installmentsCount,
    });

    const hasInvestor =
      data.investorId !== undefined ? !!data.investorId : !!oldLoan.investorId;

    const [updated] = await db
      .update(loans)
      .set({
        ...data,
        principal: principal.toFixed(2),
        interestRate: interestRate.toFixed(2),
        installmentsCount,
        totalDebt: financials.totalDebt.toFixed(2),
        isCompanyFunded: !hasInvestor,
        startDate: data.startDate
          ? new Date(data.startDate)
          : oldLoan.startDate,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, id))
      .returning();

    const shouldRecalculate = ["active", "paid", "defaulted"].includes(
      updated.status,
    );
    const recalculated = shouldRecalculate
      ? await recalculateLoanLedger(updated.id)
      : { loan: updated, overpaidAmount: updated.overpaidAmount };

    await logAudit({
      userId: user.id,
      action: "UPDATE_LOAN",
      module: "LOANS",
      entityId: id,
      oldData: oldLoan,
      newData: recalculated.loan,
      req,
    });

    const responseLoan = await selectLoanWithParticipantsById(updated.id);
    emitLoanDomainEvent(
      "loan.updated",
      {
        loanId: updated.id,
        clientId: recalculated.loan.clientId,
        investorId: recalculated.loan.investorId,
        status: recalculated.loan.status,
      },
      {
        userIds: [
          oldLoan.clientId,
          oldLoan.investorId,
          recalculated.loan.clientId,
          recalculated.loan.investorId,
        ],
      },
    );
    sendSuccess(res, 200, "Préstamo actualizado correctamente", {
      loan: responseLoan || recalculated.loan,
      overpaidAmount: recalculated.overpaidAmount,
    });
  } catch (error) {
    sendError(res, 500, "Error al actualizar préstamo", error);
  }
};

export const getAllLoans = async (
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

    const { status, clientId, investorId, from, to, search, q } = req.query;

    const conditions: SQL[] = [];

    if (user.role === "client") {
      conditions.push(eq(loans.clientId, user.id));
    } else if (user.role === "investor") {
      conditions.push(eq(loans.investorId, user.id));
    }

    conditions.push(sql`${loans.deletedAt} IS NULL`);

    if (status) {
      if (status === "pending") {
        conditions.push(
          or(
            eq(loans.status, "pending_investor_review"),
            eq(loans.status, "pending_admin_review"),
          )!,
        );
      } else {
        conditions.push(
          eq(loans.status, status as (typeof loans.status.enumValues)[number]),
        );
      }
    } else {
      conditions.push(sql`${loans.status} <> 'deleted'`);
    }
    if (clientId && user.role !== "client")
      conditions.push(eq(loans.clientId, clientId as string));
    if (investorId && user.role !== "investor")
      conditions.push(eq(loans.investorId, investorId as string));
    if (from)
      conditions.push(sql`${loans.createdAt} >= ${new Date(from as string)}`);
    if (to)
      conditions.push(sql`${loans.createdAt} <= ${new Date(to as string)}`);

    const searchTerm =
      typeof search === "string"
        ? search.trim()
        : typeof q === "string"
          ? q.trim()
          : "";

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;
      const numericTerm = searchTerm
        .replace(/,/g, "")
        .replace(/\$/g, "")
        .trim();
      const numericPattern = numericTerm ? `%${numericTerm}%` : null;

      const searchConditions = [
        ilike(loans.publicCode, searchPattern),
        ilike(loans.name, searchPattern),
        ilike(clientUsers.publicCode, searchPattern),
        ilike(investorUsers.publicCode, searchPattern),
        ilike(clientUsers.firstName, searchPattern),
        ilike(clientUsers.lastName, searchPattern),
        ilike(investorUsers.firstName, searchPattern),
        ilike(investorUsers.lastName, searchPattern),
        sql`concat(${clientUsers.firstName}, ' ', ${clientUsers.lastName}) ILIKE ${searchPattern}`,
        sql`concat(${investorUsers.firstName}, ' ', ${investorUsers.lastName}) ILIKE ${searchPattern}`,
      ];

      if (numericPattern && !isNaN(Number(numericTerm))) {
        searchConditions.push(
          sql`${loans.principal}::text ILIKE ${numericPattern}`,
        );
      }

      conditions.push(or(...searchConditions)!);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(loans)
      .innerJoin(clientUsers, eq(clientUsers.id, loans.clientId))
      .leftJoin(investorUsers, eq(investorUsers.id, loans.investorId))
      .where(where);

    const total = countRow?.total ?? 0;

    const loansData = await db
      .select(loanWithParticipantsSelection)
      .from(loans)
      .innerJoin(clientUsers, eq(clientUsers.id, loans.clientId))
      .leftJoin(investorUsers, eq(investorUsers.id, loans.investorId))
      .where(where)
      .orderBy(desc(loans.createdAt))
      .limit(limit)
      .offset(offset);

    const loanIds = loansData.map(
      (l: Record<string, unknown>) => l.id as string,
    );
    const aggMap = await getInstallmentAggregation(loanIds);

    const enrichedResults = loansData.map((loan: Record<string, unknown>) => {
      const agg = aggMap.get(loan.id as string);
      const totalPaid = Number(agg?.total_paid ?? 0);
      const totalDebt = Number(loan.totalDebt ?? 0);
      const status = loan.status as string;

      let progress: number;
      if (status === "paid") {
        progress = 100;
      } else if (
        [
          "draft",
          "pending_investor_review",
          "pending_admin_review",
          "rejected",
          "cancelled",
        ].includes(status)
      ) {
        progress = 0;
      } else {
        progress =
          totalDebt > 0
            ? Math.min(Math.round((totalPaid / totalDebt) * 100), 100)
            : 0;
      }

      const nextInstallment =
        status === "active" || status === "defaulted"
          ? (agg?.next_installment ?? null)
          : null;

      return {
        ...loan,
        totalPaid: agg?.total_paid ?? "0",
        remainingDebt: agg?.remaining_debt ?? loan.totalDebt,
        remainingInstallments:
          agg?.remaining_installments ?? loan.installmentsCount,
        nextPaymentDate: agg?.next_payment_date ?? null,
        nextPaymentAmount: null,
        nextInstallment,
        progress,
      };
    });

    const finalResults = await attachParticipantAvatars(enrichedResults);

    sendSuccess(res, 200, "Préstamos obtenidos", finalResults, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
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
    const loan = await selectLoanWithParticipantsById(id);

    if (!loan || loan.deletedAt || loan.status === "deleted") {
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

    const params = PaginationParamsMax(200).safeParse(req.query);
    if (!params.success) {
      sendError(res, 400, "Parámetros inválidos", formatZodError(params.error));
      return;
    }
    const { page, limit } = params.data;
    const offset = (page - 1) * limit;

    const user = req.user!;

    const [loan] = await db
      .select(getTableColumns(loans))
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    if (!canAccessLoan(user, loan)) {
      sendError(res, 403, "No tienes acceso al cronograma de este préstamo");
      return;
    }

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(installments)
      .where(eq(installments.loanId, loanId));

    const total = countRow?.total ?? 0;

    const results = await db
      .select()
      .from(installments)
      .where(eq(installments.loanId, loanId))
      .orderBy(installments.installmentNumber)
      .limit(limit)
      .offset(offset);

    sendSuccess(res, 200, "Cronograma obtenido", results, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener cronograma", error);
  }
};

export const getLoanBundle = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const loanId = req.params.id as string;
    const user = req.user!;
    const loan = await selectLoanWithParticipantsById(loanId);

    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    if (!canAccessLoan(user, loan)) {
      sendError(res, 403, "No tienes acceso a este préstamo");
      return;
    }

    const [loanInstallments] = await Promise.all([
      db
        .select()
        .from(installments)
        .where(eq(installments.loanId, loanId))
        .orderBy(installments.installmentNumber)
        .limit(200),
    ]);

    sendSuccess(res, 200, "Bundle de préstamo obtenido", {
      loan,
      installments: loanInstallments,
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener bundle del préstamo", error);
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
          activeLoans: sql<number>`count(*)`,
        })
        .from(loans)
        .where(and(eq(loans.investorId, user.id), eq(loans.status, "active")));

      const [paidLoansCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.investorId, user.id), eq(loans.status, "paid")));

      const [paidAmount] = await db
        .select({
          totalPaid: sql<string>`coalesce(sum(${payments.amount}), '0')`,
        })
        .from(payments)
        .innerJoin(loans, eq(loans.id, payments.loanId))
        .where(
          and(
            eq(loans.investorId, user.id),
            eq(loans.status, "paid"),
            eq(payments.status, "confirmed"),
            isNull(payments.deletedAt),
          ),
        );

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
        totalDebt: stats.expectedRevenue,
        paidLoans: paidLoansCount.count,
        totalPaid: paidAmount.totalPaid,
        overdue: overdueStats || { overdueCount: 0, overdueAmount: "0" },
      });
    } else {
      const [stats] = await db
        .select({
          totalActiveLoans: sql<number>`count(*)`,
          totalPortfolio: sql<string>`coalesce(sum(${loans.principal}), '0')`,
          totalDebt: sql<string>`coalesce(sum(${loans.totalDebt}), '0')`,
        })
        .from(loans)
        .where(eq(loans.status, "active"));

      const [paidStats] = await db
        .select({
          paidLoans: sql<number>`count(*)`,
        })
        .from(loans)
        .where(eq(loans.status, "paid"));

      const [totalPaidResult] = await db
        .select({
          totalPaid: sql<string>`coalesce(sum(${payments.amount}), '0')`,
        })
        .from(payments)
        .innerJoin(loans, eq(loans.id, payments.loanId))
        .where(
          and(eq(payments.status, "confirmed"), isNull(payments.deletedAt)),
        );

      const [overdueStats] = await db
        .select({
          overdueGlobal: sql<string>`coalesce(sum(${installments.amount} - ${installments.paidAmount}), '0')`,
        })
        .from(installments)
        .innerJoin(loans, eq(loans.id, installments.loanId))
        .where(
          and(
            eq(loans.status, "active"),
            eq(installments.status, "pending"),
            lt(installments.dueDate, now),
          ),
        );

      sendSuccess(res, 200, "Dashboard administrativo", {
        totalActiveLoans: stats.totalActiveLoans,
        activeLoans: stats.totalActiveLoans,
        totalPortfolio: stats.totalPortfolio,
        totalDebt: stats.totalDebt,
        overdueGlobal: overdueStats.overdueGlobal,
        overdueAmount: overdueStats.overdueGlobal,
        paidLoans: paidStats.paidLoans,
        totalPaid: totalPaidResult.totalPaid,
      });
    }
  } catch (error) {
    sendError(res, 500, "Error al obtener resumen", error);
  }
};

export const getAdminLoanSummary = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;

    if (!isAdminOrOwner(user)) {
      sendError(
        res,
        403,
        "No tienes permisos para ver el resumen administrativo",
      );
      return;
    }

    const params = PaginationParamsMax(100).safeParse(req.query);
    if (!params.success) {
      sendError(res, 400, "Parámetros inválidos", formatZodError(params.error));
      return;
    }
    const { page, limit } = params.data;
    const offset = (page - 1) * limit;

    const { from, to, status, q } = req.query;

    const conditions: SQL[] = [
      sql`${loans.deletedAt} IS NULL`,
      sql`${loans.status} <> 'deleted'`,
    ];

    if (status)
      conditions.push(
        eq(loans.status, status as (typeof loans.status.enumValues)[number]),
      );
    if (from)
      conditions.push(sql`${loans.createdAt} >= ${new Date(from as string)}`);
    if (to)
      conditions.push(sql`${loans.createdAt} <= ${new Date(to as string)}`);

    if (q && typeof q === "string" && q.trim()) {
      const pattern = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(loans.publicCode, pattern),
          ilike(clientUsers.publicCode, pattern),
          ilike(investorUsers.publicCode, pattern),
          ilike(clientUsers.firstName, pattern),
          ilike(clientUsers.lastName, pattern),
          ilike(investorUsers.firstName, pattern),
          ilike(investorUsers.lastName, pattern),
        )!,
      );
    }

    const where = and(...conditions);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(loans)
      .innerJoin(clientUsers, eq(clientUsers.id, loans.clientId))
      .leftJoin(investorUsers, eq(investorUsers.id, loans.investorId))
      .where(where);

    const total = countRow?.total ?? 0;

    const loansData = await db
      .select(loanWithParticipantsSelection)
      .from(loans)
      .innerJoin(clientUsers, eq(clientUsers.id, loans.clientId))
      .leftJoin(investorUsers, eq(investorUsers.id, loans.investorId))
      .where(where)
      .orderBy(desc(loans.createdAt))
      .limit(limit)
      .offset(offset);

    const loanIds = loansData.map(
      (l: Record<string, unknown>) => l.id as string,
    );
    const aggMap = await getInstallmentAggregation(loanIds);

    const results = loansData.map((loan: Record<string, unknown>) => {
      const agg = aggMap.get(loan.id as string);
      return {
        ...loan,
        paidAmount: agg?.total_paid ?? "0",
        totalInterest: (
          Number(loan.totalDebt ?? 0) - Number(loan.principal ?? 0)
        ).toFixed(2),
        remainingDebt: agg !== undefined ? agg.remaining_debt : loan.totalDebt,
        remainingInstallments:
          agg !== undefined
            ? agg.remaining_installments
            : loan.installmentsCount,
      };
    });

    sendSuccess(
      res,
      200,
      "Resumen administrativo de préstamos obtenido",
      results,
      {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    );
  } catch (error) {
    sendError(
      res,
      500,
      "Error al obtener resumen administrativo de préstamos",
      error,
    );
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

    if (!loan || loan.deletedAt || loan.status === "deleted") {
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
        data: { loanId: id },
      });

      const responseLoan = await selectLoanWithParticipantsById(updated.id);
      emitLoanDomainEvent("loan.updated", {
        loanId: updated.id,
        clientId: updated.clientId,
        investorId: updated.investorId,
        status: updated.status,
      });
      sendSuccess(
        res,
        200,
        "Préstamo aprobado por inversionista. Pendiente de Admin.",
        responseLoan || updated,
      );
      return;
    }

    if (isAdminOrOwner(user)) {
      if (loan.status === "paid") {
        sendSuccess(res, 200, "Préstamo ya se encuentra pagado", loan);
        return;
      }

      const approvableStatuses = [
        "draft",
        "pending_investor_review",
        "pending_admin_review",
        "active",
        "rejected",
        "defaulted",
      ];

      if (!approvableStatuses.includes(loan.status)) {
        sendError(
          res,
          400,
          "Este préstamo no puede ser aprobado en su estado actual",
        );
        return;
      }

      const startDate = normalizeScheduleStartDate(
        loan.startDate || new Date(),
      );
      const schedule = buildInstallmentDrafts({
        loanId: loan.id,
        principal: Number(loan.principal),
        interestRate: Number(loan.interestRate),
        installmentsCount: loan.installmentsCount,
        frequency: loan.frequency as LoanFrequency,
        startDate,
      });

      // Early return if already active
      if (loan.status === "active") {
        const existing = await db
          .select()
          .from(installments)
          .where(eq(installments.loanId, loan.id))
          .orderBy(installments.installmentNumber);

        if (existing.length > 0) {
          const responseLoan = await selectLoanWithParticipantsById(loan.id);
          sendSuccess(res, 200, "Préstamo ya se encuentra activo", {
            loan: responseLoan || loan,
            installments: existing,
          });
          return;
        }
      }

      // Transacción atómica: crear cuotas + activar préstamo
      const { installmentsList, updated } = await db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(installments)
          .where(eq(installments.loanId, loan.id))
          .orderBy(installments.installmentNumber);

        const totalDebt =
          existing.length > 0 ? Number(loan.totalDebt) : schedule.totalDebt;

        const list =
          existing.length > 0
            ? existing
            : await tx
                .insert(installments)
                .values(schedule.installments)
                .returning();

        const [updatedLoan] = await tx
          .update(loans)
          .set({
            status: "active",
            totalDebt: totalDebt.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(loans.id, id))
          .returning();

        const loanTotalDebt = totalDebt.toFixed(2);
        return {
          installmentsList: list,
          updated: updatedLoan,
          totalDebt: loanTotalDebt,
        };
      });

      const loanTotalDebt = updated.totalDebt;

      await logAudit({
        userId: user.id,
        action: "ADMIN_APPROVE_LOAN",
        module: "LOANS",
        entityId: id,
        newData: { status: "active", totalDebt: loanTotalDebt },
        req,
      });

      await sendNotification({
        userId: loan.clientId,
        title: "¡Préstamo Aprobado!",
        body: `Tu préstamo ha sido activado. Ya puedes revisar tu cronograma de pagos.`,
        type: "LOAN_ACTIVE",
        data: { loanId: id },
      });

      // Notificar al inversionista si existe
      if (loan.investorId) {
        await sendNotification({
          userId: loan.investorId,
          title: "Préstamo activado",
          body: `El préstamo que aprobaste ha sido activado por la administración.`,
          type: "LOAN_ACTIVE_INVESTOR",
          data: { loanId: id },
        });
      }

      const responseLoan = await selectLoanWithParticipantsById(updated.id);
      emitLoanDomainEvent("loan.updated", {
        loanId: updated.id,
        clientId: updated.clientId,
        investorId: updated.investorId,
        status: updated.status,
      });
      sendSuccess(res, 200, "Préstamo activado y cuotas generadas", {
        loan: responseLoan || updated,
        installments: installmentsList,
      });
      return;
    }

    sendError(res, 400, "No tienes permisos para aprobar este préstamo");
  } catch (error) {
    sendError(res, 500, "Error al aprobar el préstamo", error);
  }
};

export const deleteLoan = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    if (!isAdminOrOwner(user)) {
      sendError(res, 403, "No tienes permisos para eliminar préstamos");
      return;
    }

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);
    if (!loan || loan.deletedAt || loan.status === "deleted") {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    const [deletedLoan] = await db
      .update(loans)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loans.id, id))
      .returning();

    await logAudit({
      userId: user.id,
      action: "DELETE_LOAN",
      module: "LOANS",
      entityId: id,
      oldData: loan,
      newData: deletedLoan,
      req,
    });

    emitLoanDomainEvent("loan.deleted", {
      loanId: deletedLoan.id,
      clientId: deletedLoan.clientId,
      investorId: deletedLoan.investorId,
      status: deletedLoan.status,
    });
    sendSuccess(res, 200, "Préstamo eliminado correctamente", deletedLoan);
  } catch (error) {
    sendError(res, 500, "Error al eliminar préstamo", error);
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

    // Validar permisos según rol
    if (user.role === "investor") {
      if (
        loan.status !== "pending_investor_review" ||
        loan.investorId !== user.id
      ) {
        sendError(res, 403, "No tienes permisos para rechazar este préstamo");
        return;
      }
    } else if (isAdminOrOwner(user)) {
      if (loan.status === "paid") {
        sendError(res, 400, "No se puede rechazar un préstamo pagado");
        return;
      }

      if (loan.status === "rejected") {
        const responseLoan = await selectLoanWithParticipantsById(loan.id);
        sendSuccess(
          res,
          200,
          "Préstamo ya se encuentra rechazado",
          responseLoan || loan,
        );
        return;
      }
    } else {
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

    const responseLoan = await selectLoanWithParticipantsById(updated.id);
    emitLoanDomainEvent("loan.updated", {
      loanId: updated.id,
      clientId: updated.clientId,
      investorId: updated.investorId,
      status: updated.status,
    });
    sendSuccess(res, 200, "Préstamo rechazado", responseLoan || updated);
  } catch (error) {
    sendError(res, 500, "Error al rechazar el préstamo", error);
  }
};

export const getLoanTransactions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const loanId = req.params.id as string;
    const params = PaginationParamsMax(100).safeParse(req.query);
    if (!params.success) {
      sendError(res, 400, "Parámetros inválidos", formatZodError(params.error));
      return;
    }
    const { page, limit } = params.data;
    const offset = (page - 1) * limit;

    const [loan] = await db
      .select({
        id: loans.id,
        clientId: loans.clientId,
        investorId: loans.investorId,
      })
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) {
      sendError(res, 404, "Préstamo no encontrado");
      return;
    }

    if (!canAccessLoan(req.user, loan as unknown as typeof loans.$inferSelect)) {
      sendError(
        res,
        403,
        "No tienes acceso a las transacciones de este préstamo",
      );
      return;
    }

    const unionSql = sql`
      WITH combined AS (
        SELECT 
          'payment' as type,
          p.id,
          p.amount,
          COALESCE(p.payment_date, p.created_at) as date,
          p.status,
          row_to_json(p) as payload
        FROM payments p
        WHERE p.loan_id = ${loanId} AND p.deleted_at IS NULL

        UNION ALL

        SELECT 
          'voucher' as type,
          v.id,
          v.amount,
          COALESCE(v.operation_date, v.created_at) as date,
          v.status,
          row_to_json(v) as payload
        FROM payment_vouchers v
        WHERE v.loan_id = ${loanId} AND v.deleted_at IS NULL AND v.status != 'owner_approved'
      )
      SELECT * FROM combined
    `;

    const countResult = await db.execute(sql`
      SELECT count(*)::int as total FROM (${unionSql}) as sub
    `);
    const countRow = countResult[0] as { total?: number };
    const total = countRow?.total ?? 0;

    const dataResult = await db.execute(sql`
      ${unionSql}
      ORDER BY date DESC NULLS LAST, id ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const mappedData = dataResult.map((row: Record<string, unknown>) => {
      const payload =
        typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
      return {
        type: row.type,
        ...payload,
        date: row.date,
        evidenceUrl: payload.evidence_url || payload.evidenceUrl,
      };
    });

    const signedResults = await attachSignedUrls(mappedData as Record<string, unknown>[]);

    sendSuccess(
      res,
      200,
      "Historial de transacciones obtenido",
      signedResults,
      {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    );
  } catch (error) {
    sendError(res, 500, "Error al obtener las transacciones", error);
  }
};

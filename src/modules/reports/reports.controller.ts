import { and, desc, eq, getTableColumns, isNull, ne, sql } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { payments } from "../../db/schema/payments.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";

/**
 * Estado de cuenta de un cliente: préstamos, cuotas, pagos y mora.
 * El cliente ve el suyo; admin puede ver el de cualquier usuario.
 */
export const getClientStatement = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;
    const targetClientId = (req.params.clientId || user.id) as string;

    if (user.role === "client" && user.id !== targetClientId) {
      sendError(res, 403, "No tienes permiso para ver este estado de cuenta");
      return;
    }

    const [client] = await db
      .select({
        id: users.id,
        publicCode: users.publicCode,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, targetClientId))
      .limit(1);

    if (!client) {
      sendError(res, 404, "Cliente no encontrado");
      return;
    }

    const loanBaseFilter = and(
      eq(loans.clientId, targetClientId),
      isNull(loans.deletedAt),
      ne(loans.status, "deleted"),
    );

    const clientLoans = await db
      .select({
        ...getTableColumns(loans),
        clientCode: users.publicCode,
        clientName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        pendingInstallments: sql<number>`COALESCE((SELECT count(*) FROM ${installments} WHERE ${installments.loanId} = ${loans.id} AND ${installments.status} <> 'paid'), 0)::int`,
        totalPaid: sql<string>`COALESCE((SELECT sum(${installments.paidAmount}) FROM ${installments} WHERE ${installments.loanId} = ${loans.id}), 0)`,
      })
      .from(loans)
      .innerJoin(users, eq(users.id, loans.clientId))
      .where(loanBaseFilter)
      .orderBy(desc(loans.createdAt));

    const agg = await db.execute(sql`
      WITH client_agg AS (
        SELECT
          COALESCE(SUM(l.principal) FILTER (WHERE l.deleted_at IS NULL AND l.status <> 'deleted'), 0) as total_principal,
          COALESCE(SUM(l.total_debt) FILTER (WHERE l.deleted_at IS NULL AND l.status <> 'deleted'), 0) as total_debt,
          COUNT(*) FILTER (WHERE l.status = 'active') as active_loans,
          COUNT(*) FILTER (WHERE l.status = 'paid') as paid_loans,
          COUNT(i.id) FILTER (WHERE i.status = 'overdue') as overdue_count,
          COALESCE(SUM(i.amount - i.paid_amount) FILTER (WHERE i.status = 'overdue'), 0) as overdue_amount,
          COUNT(i.id) FILTER (WHERE i.status != 'paid' AND l.status = 'active') as pending_installments,
          COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'confirmed' AND p.deleted_at IS NULL), 0) as total_paid,
          COUNT(p.id) FILTER (WHERE p.status = 'confirmed' AND p.deleted_at IS NULL) as payment_count
        FROM ${loans} l
        LEFT JOIN ${installments} i ON i.loan_id = l.id
        LEFT JOIN ${payments} p ON p.loan_id = l.id
        WHERE l.client_id = ${targetClientId} AND l.deleted_at IS NULL AND l.status <> 'deleted'
      )
      SELECT * FROM client_agg
    `);

    const row = (agg as unknown as Record<string, unknown>[])[0] ?? {};

    sendSuccess(res, 200, "Estado de cuenta obtenido", {
      client,
      summary: {
        totalPrincipal: String(row.total_principal ?? "0"),
        totalDebt: String(row.total_debt ?? "0"),
        activeLoans: Number(row.active_loans ?? 0),
        paidLoans: Number(row.paid_loans ?? 0),
        totalPaid: String(row.total_paid ?? "0"),
        paymentCount: Number(row.payment_count ?? 0),
        overdueCount: Number(row.overdue_count ?? 0),
        overdueAmount: String(row.overdue_amount ?? "0"),
        pendingInstallments: Number(row.pending_installments ?? 0),
      },
      pendingInstallments: Number(row.pending_installments ?? 0),
      loans: clientLoans,
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener estado de cuenta", error);
  }
};

/**
 * Resumen de portafolio de un inversionista.
 */
export const getInvestorPortfolio = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;
    const targetInvestorId = (req.params.investorId || user.id) as string;

    if (user.role === "investor" && user.id !== targetInvestorId) {
      sendError(res, 403, "No tienes permiso para ver este portafolio");
      return;
    }

    // Inversiones activas
    const investorLoans = await db
      .select({
        loanId: loans.id,
        publicCode: loans.publicCode,
        clientId: loans.clientId,
        clientCode: users.publicCode,
        clientName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        principal: loans.principal,
        totalDebt: loans.totalDebt,
        status: loans.status,
        createdAt: loans.createdAt,
      })
      .from(loans)
      .innerJoin(users, eq(users.id, loans.clientId))
      .where(
        and(
          eq(loans.investorId, targetInvestorId),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
        ),
      )
      .orderBy(desc(loans.createdAt));

    // Estadísticas
    const [stats] = await db
      .select({
        totalInvested: sql<string>`COALESCE(sum(${loans.principal}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
        expectedRevenue: sql<string>`COALESCE(sum(${loans.totalDebt}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
        activeLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'active')`,
        paidLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'paid')`,
        defaultedLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'defaulted')`,
      })
      .from(loans)
      .where(
        and(
          eq(loans.investorId, targetInvestorId),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
        ),
      );

    const [paymentStats] = await db
      .select({
        collectedAmount: sql<string>`COALESCE(sum(${payments.amount}), 0)`,
        confirmedPayments: sql<number>`count(*)`,
      })
      .from(payments)
      .innerJoin(loans, eq(loans.id, payments.loanId))
      .where(
        and(
          eq(loans.investorId, targetInvestorId),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
          eq(payments.status, "confirmed"),
          isNull(payments.deletedAt),
        ),
      );

    // Vouchers pendientes de revisión del inversionista
    const pendingVouchers = await db
      .select({
        voucherId: paymentVouchers.id,
        loanId: paymentVouchers.loanId,
        loanPublicCode: loans.publicCode,
        amount: paymentVouchers.amount,
        operationId: paymentVouchers.operationId,
        createdAt: paymentVouchers.createdAt,
      })
      .from(paymentVouchers)
      .innerJoin(loans, eq(loans.id, paymentVouchers.loanId))
      .where(
        and(
          eq(loans.investorId, targetInvestorId),
          eq(paymentVouchers.status, "pending_investor_review"),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
          isNull(paymentVouchers.deletedAt),
        ),
      )
      .orderBy(desc(paymentVouchers.createdAt));

    const summary = {
      ...stats,
      collectedAmount: paymentStats?.collectedAmount || "0",
      confirmedPayments: paymentStats?.confirmedPayments || 0,
      totalReturn: stats?.expectedRevenue || "0",
    };

    sendSuccess(res, 200, "Portafolio de inversiones obtenido", {
      summary,
      collectedAmount: summary.collectedAmount,
      investments: investorLoans,
      loans: investorLoans,
      pendingVouchers,
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener portafolio", error);
  }
};

/**
 * Resumen global administrativo.
 */
export const getAdminDashboard = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const agg = await db.execute(sql`
      WITH dashboard_agg AS (
        SELECT
          COUNT(*) as total_loans,
          COUNT(*) FILTER (WHERE l.status = 'active') as active_loans,
          COUNT(*) FILTER (WHERE l.status IN ('pending_investor_review', 'pending_admin_review')) as pending_loans,
          COALESCE(SUM(l.principal) FILTER (WHERE l.status = 'active'), 0) as total_portfolio,
          COALESCE(SUM(l.total_debt) FILTER (WHERE l.status = 'active'), 0) as total_debt,
          COUNT(i.id) FILTER (WHERE i.status = 'overdue') as overdue_count,
          COALESCE(SUM(i.amount - i.paid_amount) FILTER (WHERE i.status = 'overdue'), 0) as overdue_amount,
          COUNT(v.id) FILTER (WHERE v.status = 'pending_investor_review') as pending_investor_vouchers,
          COUNT(v.id) FILTER (WHERE v.status IN ('pending_admin_review', 'investor_approved')) as pending_admin_vouchers
        FROM ${loans} l
        LEFT JOIN ${installments} i ON i.loan_id = l.id AND l.deleted_at IS NULL AND l.status <> 'deleted'
        LEFT JOIN ${paymentVouchers} v ON v.loan_id = l.id AND v.deleted_at IS NULL AND v.status <> 'deleted'
        WHERE l.deleted_at IS NULL AND l.status <> 'deleted'
      )
      SELECT * FROM dashboard_agg
    `);

    const loanRow = (agg as unknown as Record<string, unknown>[])[0] ?? {};

    const [userStats] = await db
      .select({
        totalUsers: sql<number>`count(*)`,
        clients: sql<number>`count(*) FILTER (WHERE ${users.role} = 'client')`,
        investors: sql<number>`count(*) FILTER (WHERE ${users.role} = 'investor')`,
        admins: sql<number>`count(*) FILTER (WHERE ${users.role} = 'admin')`,
      })
      .from(users)
      .where(and(eq(users.active, true), isNull(users.deletedAt)));

    sendSuccess(res, 200, "Dashboard administrativo", {
      loans: {
        totalLoans: Number(loanRow.total_loans ?? 0),
        activeLoans: Number(loanRow.active_loans ?? 0),
        pendingLoans: Number(loanRow.pending_loans ?? 0),
        totalPortfolio: String(loanRow.total_portfolio ?? "0"),
        totalDebt: String(loanRow.total_debt ?? "0"),
      },
      overdue: {
        overdueCount: Number(loanRow.overdue_count ?? 0),
        overdueAmount: String(loanRow.overdue_amount ?? "0"),
      },
      vouchers: {
        pendingInvestor: Number(loanRow.pending_investor_vouchers ?? 0),
        pendingAdmin: Number(loanRow.pending_admin_vouchers ?? 0),
      },
      users: userStats,
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener dashboard", error);
  }
};

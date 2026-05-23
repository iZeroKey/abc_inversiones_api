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

    // Solo el propio cliente o un admin puede ver el estado de cuenta
    if (user.role === "client" && user.id !== targetClientId) {
      sendError(res, 403, "No tienes permiso para ver este estado de cuenta");
      return;
    }

    // Datos del cliente
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

    // Préstamos del cliente
    const clientLoans = await db
      .select({
        ...getTableColumns(loans),
        clientCode: users.publicCode,
        clientName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(loans)
      .innerJoin(users, eq(users.id, loans.clientId))
      .where(
        and(
          eq(loans.clientId, targetClientId),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
        ),
      )
      .orderBy(desc(loans.createdAt));

    // Estadísticas generales
    const [stats] = await db
      .select({
        totalPrincipal: sql<string>`COALESCE(sum(${loans.principal}), 0)`,
        totalDebt: sql<string>`COALESCE(sum(${loans.totalDebt}), 0)`,
        activeLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'active')`,
        paidLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'paid')`,
      })
      .from(loans)
      .where(
        and(
          eq(loans.clientId, targetClientId),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
        ),
      );

    // Cuotas vencidas
    const [overdueStats] = await db
      .select({
        overdueCount: sql<number>`count(*)`,
        overdueAmount: sql<string>`COALESCE(sum(${installments.amount} - ${installments.paidAmount}), 0)`,
      })
      .from(installments)
      .innerJoin(loans, eq(loans.id, installments.loanId))
      .where(
        and(
          eq(loans.clientId, targetClientId),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
          eq(installments.status, "overdue"),
        ),
      );

    // Total pagado (de payments confirmados)
    const [paymentStats] = await db
      .select({
        totalPaid: sql<string>`COALESCE(sum(${payments.amount}), 0)`,
        paymentCount: sql<number>`count(*)`,
      })
      .from(payments)
      .innerJoin(loans, eq(loans.id, payments.loanId))
      .where(
        and(
          eq(loans.clientId, targetClientId),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
          eq(payments.status, "confirmed"),
          isNull(payments.deletedAt),
        ),
      );

    sendSuccess(res, 200, "Estado de cuenta obtenido", {
      client,
      summary: {
        ...stats,
        totalPaid: paymentStats?.totalPaid || "0",
        paymentCount: paymentStats?.paymentCount || 0,
        overdueCount: overdueStats?.overdueCount || 0,
        overdueAmount: overdueStats?.overdueAmount || "0",
      },
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

    sendSuccess(res, 200, "Portafolio de inversiones obtenido", {
      summary: stats,
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
    // Estadísticas globales de préstamos
    const [loanStats] = await db
      .select({
        totalLoans: sql<number>`count(*)`,
        activeLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'active')`,
        pendingLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} IN ('pending_investor_review', 'pending_admin_review'))`,
        totalPortfolio: sql<string>`COALESCE(sum(${loans.principal}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
        totalDebt: sql<string>`COALESCE(sum(${loans.totalDebt}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
      })
      .from(loans)
      .where(and(isNull(loans.deletedAt), ne(loans.status, "deleted")));

    // Mora global
    const [overdueStats] = await db
      .select({
        overdueCount: sql<number>`count(*)`,
        overdueAmount: sql<string>`COALESCE(sum(${installments.amount} - ${installments.paidAmount}), 0)`,
      })
      .from(installments)
      .innerJoin(loans, eq(loans.id, installments.loanId))
      .where(
        and(
          eq(installments.status, "overdue"),
          isNull(loans.deletedAt),
          ne(loans.status, "deleted"),
        ),
      );

    // Vouchers pendientes de procesamiento
    const [voucherStats] = await db
      .select({
        pendingInvestor: sql<number>`count(*) FILTER (WHERE ${paymentVouchers.status} = 'pending_investor_review')`,
        pendingAdmin: sql<number>`count(*) FILTER (WHERE ${paymentVouchers.status} IN ('pending_admin_review', 'investor_approved'))`,
      })
      .from(paymentVouchers)
      .where(
        and(
          isNull(paymentVouchers.deletedAt),
          ne(paymentVouchers.status, "deleted"),
        ),
      );

    // Usuarios activos
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
      loans: loanStats,
      overdue: overdueStats,
      vouchers: voucherStats,
      users: userStats,
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener dashboard", error);
  }
};

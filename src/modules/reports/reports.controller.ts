import { Response } from "express";
import { db } from "../../config/db.js";
import { loans } from "../../db/schema/loans.js";
import { installments } from "../../db/schema/installments.js";
import { payments } from "../../db/schema/payments.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { users } from "../../db/schema/users.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { sendSuccess, sendError } from "../../utils/response.util.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";

/**
 * Estado de cuenta de un cliente: préstamos, cuotas, pagos y mora.
 * El cliente ve el suyo; admin puede ver el de cualquier usuario.
 */
export const getClientStatement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetClientId = (req.params.clientId || user.id) as string;

    // Solo el propio cliente o un admin puede ver el estado de cuenta
    if (user.role === "client" && user.id !== targetClientId) {
      sendError(res, 403, "No tienes permiso para ver este estado de cuenta");
      return;
    }

    // Datos del cliente
    const [client] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
    }).from(users).where(eq(users.id, targetClientId)).limit(1);

    if (!client) {
      sendError(res, 404, "Cliente no encontrado");
      return;
    }

    // Préstamos del cliente
    const clientLoans = await db.select().from(loans)
      .where(eq(loans.clientId, targetClientId))
      .orderBy(desc(loans.createdAt));

    // Estadísticas generales
    const [stats] = await db.select({
      totalPrincipal: sql<string>`COALESCE(sum(${loans.principal}), 0)`,
      totalDebt: sql<string>`COALESCE(sum(${loans.totalDebt}), 0)`,
      activeLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'active')`,
      paidLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'paid')`,
    }).from(loans).where(eq(loans.clientId, targetClientId));

    // Cuotas vencidas
    const [overdueStats] = await db.select({
      overdueCount: sql<number>`count(*)`,
      overdueAmount: sql<string>`COALESCE(sum(${installments.amount} - ${installments.paidAmount}), 0)`,
    })
      .from(installments)
      .innerJoin(loans, eq(loans.id, installments.loanId))
      .where(and(
        eq(loans.clientId, targetClientId),
        eq(installments.status, "overdue"),
      ));

    // Total pagado (de payments confirmados)
    const [paymentStats] = await db.select({
      totalPaid: sql<string>`COALESCE(sum(${payments.amount}), 0)`,
      paymentCount: sql<number>`count(*)`,
    })
      .from(payments)
      .innerJoin(loans, eq(loans.id, payments.loanId))
      .where(eq(loans.clientId, targetClientId));

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
export const getInvestorPortfolio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const targetInvestorId = (req.params.investorId || user.id) as string;

    if (user.role === "investor" && user.id !== targetInvestorId) {
      sendError(res, 403, "No tienes permiso para ver este portafolio");
      return;
    }

    // Inversiones activas
    const investorLoans = await db.select({
      loanId: loans.id,
      clientId: loans.clientId,
      principal: loans.principal,
      totalDebt: loans.totalDebt,
      status: loans.status,
      createdAt: loans.createdAt,
    }).from(loans)
      .where(eq(loans.investorId, targetInvestorId))
      .orderBy(desc(loans.createdAt));

    // Estadísticas
    const [stats] = await db.select({
      totalInvested: sql<string>`COALESCE(sum(${loans.principal}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
      expectedRevenue: sql<string>`COALESCE(sum(${loans.totalDebt}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
      activeLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'active')`,
      paidLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'paid')`,
      defaultedLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'defaulted')`,
    }).from(loans).where(eq(loans.investorId, targetInvestorId));

    // Vouchers pendientes de revisión del inversionista
    const pendingVouchers = await db.select({
      voucherId: paymentVouchers.id,
      loanId: paymentVouchers.loanId,
      amount: paymentVouchers.amount,
      operationId: paymentVouchers.operationId,
      createdAt: paymentVouchers.createdAt,
    }).from(paymentVouchers)
      .innerJoin(loans, eq(loans.id, paymentVouchers.loanId))
      .where(and(
        eq(loans.investorId, targetInvestorId),
        eq(paymentVouchers.status, "pending_investor_review"),
      ))
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
export const getAdminDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Estadísticas globales de préstamos
    const [loanStats] = await db.select({
      totalLoans: sql<number>`count(*)`,
      activeLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'active')`,
      pendingLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} IN ('pending_investor_review', 'pending_admin_review'))`,
      totalPortfolio: sql<string>`COALESCE(sum(${loans.principal}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
      totalDebt: sql<string>`COALESCE(sum(${loans.totalDebt}) FILTER (WHERE ${loans.status} = 'active'), 0)`,
    }).from(loans);

    // Mora global
    const [overdueStats] = await db.select({
      overdueCount: sql<number>`count(*)`,
      overdueAmount: sql<string>`COALESCE(sum(${installments.amount} - ${installments.paidAmount}), 0)`,
    }).from(installments)
      .where(eq(installments.status, "overdue"));

    // Vouchers pendientes de procesamiento
    const [voucherStats] = await db.select({
      pendingInvestor: sql<number>`count(*) FILTER (WHERE ${paymentVouchers.status} = 'pending_investor_review')`,
      pendingAdmin: sql<number>`count(*) FILTER (WHERE ${paymentVouchers.status} = 'investor_approved')`,
    }).from(paymentVouchers);

    // Usuarios activos
    const [userStats] = await db.select({
      totalUsers: sql<number>`count(*)`,
      clients: sql<number>`count(*) FILTER (WHERE ${users.role} = 'client')`,
      investors: sql<number>`count(*) FILTER (WHERE ${users.role} = 'investor')`,
      admins: sql<number>`count(*) FILTER (WHERE ${users.role} = 'admin')`,
    }).from(users).where(eq(users.active, true));

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

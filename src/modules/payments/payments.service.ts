import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { payments } from "../../db/schema/payments.js";
import { buildInstallmentDrafts } from "../loans/loans.finance.js";
import {
  normalizeScheduleStartDate,
  type LoanFrequency,
} from "../loans/loans.schedule.js";

export interface ProcessPaymentParams {
  loanId: string;
  amount: string;
  method: "cash" | "transfer" | "deposit" | "other";
  registeredById: string;
  voucherId?: string | null;
  reference?: string;
  observation?: string;
  evidenceUrl?: string | null;
  paymentDate?: Date;
  installmentId?: string | null;
  allowOverpayment?: boolean;
}

export class PaymentBusinessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "PaymentBusinessError";
  }
}

const toCents = (value: string | number): number => {
  return Math.round(Number(value) * 100);
};

const fromCents = (value: number): string => {
  return (value / 100).toFixed(2);
};

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const recalculateLoanLedgerInTransaction = async (
  tx: DbTransaction,
  loanId: string,
) => {
  // Bloquea la fila del préstamo para evitar recálculos concurrentes
  await tx.execute(sql`SELECT id FROM ${loans} WHERE id = ${loanId} FOR UPDATE`);

  const [loan] = await tx
    .select()
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);
  if (!loan) throw new PaymentBusinessError("Préstamo no encontrado", 404);
  if (loan.deletedAt || loan.status === "deleted") {
    throw new PaymentBusinessError("El préstamo fue eliminado");
  }

  if (!["active", "paid", "defaulted"].includes(loan.status)) {
    return {
      loan,
      overpaidAmount: "0.00",
    };
  }

  const schedule = buildInstallmentDrafts({
    loanId: loan.id,
    principal: Number(loan.principal),
    interestRate: Number(loan.interestRate),
    installmentsCount: loan.installmentsCount,
    frequency: loan.frequency as LoanFrequency,
    startDate: normalizeScheduleStartDate(loan.startDate || new Date()),
  });

  await tx
    .update(payments)
    .set({ installmentId: null, updatedAt: new Date() })
    .where(eq(payments.loanId, loanId));

  await tx.delete(installments).where(eq(installments.loanId, loanId));
  await tx.insert(installments).values(schedule.installments);

  const confirmedPayments = await tx
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.loanId, loanId),
        eq(payments.status, "confirmed"),
        isNull(payments.deletedAt),
      ),
    )
    .orderBy(asc(payments.paymentDate), asc(payments.createdAt));

  let overpaidCents = 0;

  for (const payment of confirmedPayments) {
    let remainingBalance = toCents(payment.amount);

    const pendingInstallments = await tx
      .select()
      .from(installments)
      .where(
        and(
          eq(installments.loanId, loanId),
          or(
            eq(installments.status, "pending"),
            eq(installments.status, "overdue"),
          ),
        ),
      )
      .orderBy(asc(installments.dueDate));

    const outstandingDebt = pendingInstallments.reduce((total, inst) => {
      return (
        total + Math.max(toCents(inst.amount) - toCents(inst.paidAmount), 0)
      );
    }, 0);

    if (remainingBalance > outstandingDebt) {
      overpaidCents += remainingBalance - outstandingDebt;
      remainingBalance = outstandingDebt;
    }

    for (const inst of pendingInstallments) {
      if (remainingBalance <= 0) break;

      const installmentAmount = toCents(inst.amount);
      const currentPaidAmount = toCents(inst.paidAmount);
      const currentDebt = Math.max(installmentAmount - currentPaidAmount, 0);
      const paymentForThisInst = Math.min(remainingBalance, currentDebt);
      const newPaidAmount = currentPaidAmount + paymentForThisInst;
      const nextStatus =
        newPaidAmount >= installmentAmount
          ? "paid"
          : inst.dueDate < new Date()
            ? "overdue"
            : "pending";

      remainingBalance -= paymentForThisInst;

      await tx
        .update(installments)
        .set({
          paidAmount: fromCents(newPaidAmount),
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(installments.id, inst.id));
    }
  }

  const finalInstallments = await tx
    .select()
    .from(installments)
    .where(eq(installments.loanId, loanId));

  for (const inst of finalInstallments) {
    const paidCents = toCents(inst.paidAmount);
    const amountCents = toCents(inst.amount);
    const nextStatus =
      paidCents >= amountCents
        ? "paid"
        : inst.dueDate < new Date()
          ? "overdue"
          : "pending";

    if (inst.status !== nextStatus) {
      await tx
        .update(installments)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(installments.id, inst.id));
    }
  }

  const hasUnpaidInstallments = finalInstallments.some(
    (inst) => toCents(inst.paidAmount) < toCents(inst.amount),
  );

  const [updatedLoan] = await tx
    .update(loans)
    .set({
      totalDebt: schedule.totalDebt.toFixed(2),
      overpaidAmount: fromCents(overpaidCents),
      status: hasUnpaidInstallments ? "active" : "paid",
      updatedAt: new Date(),
    })
    .where(eq(loans.id, loanId))
    .returning();

  return {
    loan: updatedLoan,
    overpaidAmount: fromCents(overpaidCents),
  };
};

export const recalculateLoanLedger = async (loanId: string) => {
  return await db.transaction((tx) =>
    recalculateLoanLedgerInTransaction(tx, loanId),
  );
};

/**
 * Lógica central de aplicación de pagos (Waterfall logic)
 */
export const processPaymentLogicInTransaction = async (
  tx: DbTransaction,
  params: ProcessPaymentParams,
) => {
  const {
    loanId,
    amount,
    method,
    reference,
    observation,
    registeredById,
    paymentDate,
    voucherId,
    evidenceUrl,
    allowOverpayment = false,
  } = params;
  const amountToApply = toCents(amount);
  const effectivePaymentDate = paymentDate || new Date();

  const [loan] = await tx
    .select()
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);
  if (!loan) throw new PaymentBusinessError("Préstamo no encontrado", 404);
  if (loan.deletedAt || loan.status === "deleted") {
    throw new PaymentBusinessError("El préstamo fue eliminado");
  }
  if (loan.status !== "active")
    throw new PaymentBusinessError("El préstamo no está activo");

  const pendingInstallments = await tx
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.loanId, loanId),
        or(
          eq(installments.status, "pending"),
          eq(installments.status, "overdue"),
        ),
      ),
    )
    .orderBy(asc(installments.dueDate));

  const outstandingDebt = pendingInstallments.reduce((total, inst) => {
    return total + Math.max(toCents(inst.amount) - toCents(inst.paidAmount), 0);
  }, 0);

  if (outstandingDebt <= 0) {
    throw new PaymentBusinessError("El préstamo no tiene deuda pendiente");
  }

  if (!allowOverpayment && amountToApply > outstandingDebt) {
    throw new PaymentBusinessError("El pago excede la deuda pendiente");
  }

  const [newPayment] = await tx
    .insert(payments)
    .values({
      loanId,
      voucherId,
      amount: fromCents(amountToApply),
      method,
      reference,
      observation,
      evidenceUrl,
      registeredById,
      paymentDate: effectivePaymentDate,
    })
    .returning();

  await recalculateLoanLedgerInTransaction(tx, loanId);

  return newPayment;
};

export const processPaymentLogic = async (params: ProcessPaymentParams) => {
  return await db.transaction((tx) =>
    processPaymentLogicInTransaction(tx, params),
  );
};

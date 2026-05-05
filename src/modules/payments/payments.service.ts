import { db } from "../../config/db.js";
import { payments } from "../../db/schema/payments.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { eq, and, asc, sql, or, ne } from "drizzle-orm";

export interface ProcessPaymentParams {
  loanId: string;
  amount: string;
  method: "cash" | "transfer" | "deposit" | "other";
  registeredById: string;
  reference?: string;
  observation?: string;
  paymentDate?: Date;
  installmentId?: string | null;
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

/**
 * Lógica central de aplicación de pagos (Waterfall logic)
 */
export const processPaymentLogic = async (params: ProcessPaymentParams) => {
  return await db.transaction(async (tx) => {
    const { loanId, amount, method, reference, observation, registeredById, paymentDate } = params;
    const amountToApply = toCents(amount);
    const effectivePaymentDate = paymentDate || new Date();

    const [loan] = await tx.select().from(loans).where(eq(loans.id, loanId)).limit(1);
    if (!loan) throw new PaymentBusinessError("Préstamo no encontrado", 404);
    if (loan.status !== "active") throw new PaymentBusinessError("El préstamo no está activo");

    const pendingInstallments = await tx.select()
      .from(installments)
      .where(and(
        eq(installments.loanId, loanId),
        or(eq(installments.status, "pending"), eq(installments.status, "overdue")),
      ))
      .orderBy(asc(installments.dueDate));

    const outstandingDebt = pendingInstallments.reduce((total, inst) => {
      return total + Math.max(toCents(inst.amount) - toCents(inst.paidAmount), 0);
    }, 0);

    if (outstandingDebt <= 0) {
      throw new PaymentBusinessError("El préstamo no tiene deuda pendiente");
    }

    if (amountToApply > outstandingDebt) {
      throw new PaymentBusinessError("El pago excede la deuda pendiente");
    }

    const [newPayment] = await tx.insert(payments).values({
      loanId,
      amount: fromCents(amountToApply),
      method,
      reference,
      observation,
      registeredById,
      paymentDate: effectivePaymentDate,
    }).returning();

    let remainingBalance = amountToApply;

    for (const inst of pendingInstallments) {
      if (remainingBalance <= 0) break;

      const installmentAmount = toCents(inst.amount);
      const currentPaidAmount = toCents(inst.paidAmount);
      const currentDebt = Math.max(installmentAmount - currentPaidAmount, 0);
      const paymentForThisInst = Math.min(remainingBalance, currentDebt);
      const newPaidAmount = currentPaidAmount + paymentForThisInst;
      const nextStatus = newPaidAmount >= installmentAmount
        ? "paid"
        : inst.dueDate < effectivePaymentDate
          ? "overdue"
          : "pending";
      
      remainingBalance -= paymentForThisInst;

      await tx.update(installments)
        .set({
          paidAmount: fromCents(newPaidAmount),
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(installments.id, inst.id));
    }

    const [remainingPending] = await tx.select({ count: sql<number>`count(*)` })
      .from(installments)
      .where(and(eq(installments.loanId, loanId), ne(installments.status, "paid")));

    if (Number(remainingPending.count) === 0) {
      await tx.update(loans)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(loans.id, loanId));
    }

    return newPayment;
  });
};

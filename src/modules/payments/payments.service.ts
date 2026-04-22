import { db } from "../../config/db.js";
import { payments } from "../../db/schema/payments.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { eq, and, asc, sql } from "drizzle-orm";

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

/**
 * Lógica central de aplicación de pagos (Waterfall logic)
 */
export const processPaymentLogic = async (params: ProcessPaymentParams) => {
  return await db.transaction(async (tx) => {
    const { loanId, amount, method, reference, observation, registeredById, paymentDate } = params;
    const amountToApply = Number(amount);

    const [loan] = await tx.select().from(loans).where(eq(loans.id, loanId)).limit(1);
    if (!loan) throw new Error("Préstamo no encontrado");
    if (loan.status !== "active") throw new Error("El préstamo no está activo");

    const [newPayment] = await tx.insert(payments).values({
      loanId,
      amount,
      method,
      reference,
      observation,
      registeredById,
      paymentDate: paymentDate || new Date(),
    }).returning();

    const pendingInstallments = await tx.select()
      .from(installments)
      .where(and(eq(installments.loanId, loanId), eq(installments.status, "pending")))
      .orderBy(asc(installments.dueDate));

    let remainingBalance = amountToApply;

    for (const inst of pendingInstallments) {
      if (remainingBalance <= 0) break;

      const currentDebt = Number(inst.amount) - Number(inst.paidAmount);
      const paymentForThisInst = Math.min(remainingBalance, currentDebt);
      const newPaidAmount = Number(inst.paidAmount) + paymentForThisInst;
      
      remainingBalance -= paymentForThisInst;

      await tx.update(installments)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          status: newPaidAmount >= Number(inst.amount) ? "paid" : "pending",
          updatedAt: new Date(),
        })
        .where(eq(installments.id, inst.id));
    }

    const [remainingPending] = await tx.select({ count: sql<number>`count(*)` })
      .from(installments)
      .where(and(eq(installments.loanId, loanId), eq(installments.status, "pending")));

    if (Number(remainingPending.count) === 0) {
      await tx.update(loans)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(loans.id, loanId));
    }

    return newPayment;
  });
};

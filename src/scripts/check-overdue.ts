import "dotenv/config";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../config/db.js";
import { installments } from "../db/schema/installments.js";
import { loans } from "../db/schema/loans.js";
import { sendNotification } from "../utils/notification.util.js";

async function checkOverdueInstallments() {
  console.log("Verificando cuotas vencidas...\n");

  const now = new Date();

  const overdueInstallments = await db
    .select({
      installmentId: installments.id,
      loanId: installments.loanId,
      installmentNumber: installments.installmentNumber,
      dueDate: installments.dueDate,
      amount: installments.amount,
      paidAmount: installments.paidAmount,
    })
    .from(installments)
    .where(
      and(eq(installments.status, "pending"), lt(installments.dueDate, now)),
    );

  if (overdueInstallments.length === 0) {
    console.log("  No hay cuotas vencidas.");
    process.exit(0);
  }

  console.log(
    `  Se encontraron ${overdueInstallments.length} cuota(s) vencida(s).\n`,
  );

  for (const inst of overdueInstallments) {
    await db
      .update(installments)
      .set({ status: "overdue", updatedAt: new Date() })
      .where(eq(installments.id, inst.installmentId));
  }

  const affectedLoanIds = [
    ...new Set(overdueInstallments.map((i) => i.loanId)),
  ];

  for (const loanId of affectedLoanIds) {
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);
    if (!loan) continue;

    const overdueForLoan = overdueInstallments.filter(
      (i) => i.loanId === loanId,
    );

    await sendNotification({
      userId: loan.clientId,
      title: "Cuota(s) vencida(s)",
      body: `Tienes ${overdueForLoan.length} cuota(s) vencida(s) en tu préstamo. Regulariza tu situación lo antes posible.`,
      type: "INSTALLMENT_OVERDUE",
      data: { loanId, count: overdueForLoan.length },
    });

    console.log(
      `  Notificación enviada al cliente ${loan.clientId} (${overdueForLoan.length} cuotas vencidas).`,
    );
  }

  console.log(
    `\nProceso completado. ${overdueInstallments.length} cuotas marcadas como vencidas.`,
  );
  process.exit(0);
}

checkOverdueInstallments().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

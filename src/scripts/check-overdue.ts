/**
 * Script de detección de cuotas vencidas.
 * Actualiza installments.status de "pending" a "overdue" cuando dueDate < NOW().
 * Envía notificaciones a los clientes afectados.
 *
 * Uso manual:    npx tsx src/scripts/check-overdue.ts
 * Uso con cron:  Configurar como pg_cron job o cron externo.
 *
 * Para configurar pg_cron en Supabase (Dashboard > Database > Extensions > pg_cron):
 *
 *   -- Habilitar la extensión pg_cron
 *   CREATE EXTENSION IF NOT EXISTS pg_cron;
 *
 *   -- Programar ejecución diaria a las 6 AM (UTC)
 *   SELECT cron.schedule(
 *     'check-overdue-installments',
 *     '0 6 * * *',
 *     $$
 *       UPDATE installments
 *       SET status = 'overdue', updated_at = NOW()
 *       WHERE status = 'pending' AND due_date < NOW();
 *     $$
 *   );
 */

import "dotenv/config";
import { db } from "../config/db.js";
import { installments } from "../db/schema/installments.js";
import { loans } from "../db/schema/loans.js";
import { eq, and, lt, sql } from "drizzle-orm";
import { sendNotification } from "../utils/notification.util.js";

async function checkOverdueInstallments() {
  console.log("Verificando cuotas vencidas...\n");

  const now = new Date();

  // 1. Obtener cuotas pendientes cuya fecha ya pasó
  const overdueInstallments = await db.select({
    installmentId: installments.id,
    loanId: installments.loanId,
    installmentNumber: installments.installmentNumber,
    dueDate: installments.dueDate,
    amount: installments.amount,
    paidAmount: installments.paidAmount,
  })
    .from(installments)
    .where(and(eq(installments.status, "pending"), lt(installments.dueDate, now)));

  if (overdueInstallments.length === 0) {
    console.log("  No hay cuotas vencidas.");
    process.exit(0);
  }

  console.log(`  Se encontraron ${overdueInstallments.length} cuota(s) vencida(s).\n`);

  // 2. Actualizar estado a "overdue"
  for (const inst of overdueInstallments) {
    await db.update(installments)
      .set({ status: "overdue", updatedAt: new Date() })
      .where(eq(installments.id, inst.installmentId));
  }

  // 3. Obtener los préstamos afectados y notificar a los clientes
  const affectedLoanIds = [...new Set(overdueInstallments.map(i => i.loanId))];

  for (const loanId of affectedLoanIds) {
    const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
    if (!loan) continue;

    const overdueForLoan = overdueInstallments.filter(i => i.loanId === loanId);

    await sendNotification({
      userId: loan.clientId,
      title: "Cuota(s) vencida(s)",
      body: `Tienes ${overdueForLoan.length} cuota(s) vencida(s) en tu préstamo. Regulariza tu situación lo antes posible.`,
      type: "INSTALLMENT_OVERDUE",
      data: { loanId, count: overdueForLoan.length },
    });

    console.log(`  Notificación enviada al cliente ${loan.clientId} (${overdueForLoan.length} cuotas vencidas).`);
  }

  console.log(`\nProceso completado. ${overdueInstallments.length} cuotas marcadas como vencidas.`);
  process.exit(0);
}

checkOverdueInstallments().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

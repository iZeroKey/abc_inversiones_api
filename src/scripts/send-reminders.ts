/**
 * Script de recordatorio de cuotas próximas a vencer.
 * Notifica a los clientes cuando tienen cuotas que vencen en los próximos 3 días.
 *
 * Uso manual:    npx tsx src/scripts/send-reminders.ts
 * Uso con cron:  Configurar ejecución diaria (ej: 8 AM)
 *
 *   SELECT cron.schedule(
 *     'send-installment-reminders',
 *     '0 8 * * *',
 *     $$ -- Este job debe ejecutar el script externamente o usar una Edge Function $$
 *   );
 */

import "dotenv/config";
import { db } from "../config/db.js";
import { installments } from "../db/schema/installments.js";
import { loans } from "../db/schema/loans.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { sendNotification } from "../utils/notification.util.js";

const DAYS_BEFORE = 3; // Notificar 3 días antes del vencimiento

async function sendReminders() {
  console.log("Enviando recordatorios de cuotas próximas a vencer...\n");

  const now = new Date();
  const futureDate = new Date(now.getTime() + DAYS_BEFORE * 24 * 60 * 60 * 1000);

  // Buscar cuotas pendientes que venzan en los próximos DAYS_BEFORE días
  const upcomingInstallments = await db.select({
    installmentId: installments.id,
    loanId: installments.loanId,
    installmentNumber: installments.installmentNumber,
    dueDate: installments.dueDate,
    amount: installments.amount,
    paidAmount: installments.paidAmount,
  })
    .from(installments)
    .where(
      and(
        eq(installments.status, "pending"),
        gte(installments.dueDate, now),
        lte(installments.dueDate, futureDate),
      )
    );

  if (upcomingInstallments.length === 0) {
    console.log("  No hay cuotas próximas a vencer.");
    process.exit(0);
  }

  console.log(`  Se encontraron ${upcomingInstallments.length} cuota(s) próximas a vencer.\n`);

  // Agrupar por préstamo para obtener el clientId
  const affectedLoanIds = [...new Set(upcomingInstallments.map(i => i.loanId))];

  for (const loanId of affectedLoanIds) {
    const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
    if (!loan) continue;

    const installmentsForLoan = upcomingInstallments.filter(i => i.loanId === loanId);

    for (const inst of installmentsForLoan) {
      const daysUntilDue = Math.ceil((new Date(inst.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const remaining = Number(inst.amount) - Number(inst.paidAmount);

      await sendNotification({
        userId: loan.clientId,
        title: "Recordatorio de cuota",
        body: `Tu cuota #${inst.installmentNumber} de ${remaining.toFixed(2)} vence en ${daysUntilDue} día(s). Realiza tu pago a tiempo.`,
        type: "INSTALLMENT_REMINDER",
        data: { loanId, installmentId: inst.installmentId, dueDate: inst.dueDate },
      });

      console.log(`  Recordatorio enviado al cliente ${loan.clientId} - Cuota #${inst.installmentNumber} (vence en ${daysUntilDue}d).`);
    }
  }

  console.log(`\n${upcomingInstallments.length} recordatorio(s) enviado(s).`);
  process.exit(0);
}

sendReminders().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

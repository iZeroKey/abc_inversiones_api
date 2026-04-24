import { pgTable, text, timestamp, numeric, uuid, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loans } from "./loans.js";
import { users } from "./users.js";
import { installments } from "./installments.js";

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  loanId: uuid("loan_id").notNull().references(() => loans.id),
  installmentId: uuid("installment_id").references(() => installments.id), // Opcional, si paga una cuota específica
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).defaultNow().notNull(),
  method: text("method", { enum: ["cash", "transfer", "deposit", "other"] }).notNull().default("cash"),
  reference: text("reference"), // Número de operación, etc.
  observation: text("observation"),
  registeredById: text("registered_by_id").notNull().references(() => users.id),
  status: text("status", { enum: ["confirmed", "reversed"] }).notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, () => [
  // RLS para Pagos
  pgPolicy("admin_payments_all", {
    for: "all",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.is_owner = true))`,
  }),
  pgPolicy("client_payments_select", {
    for: "select",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = payments.loan_id AND loans.client_id = auth.uid())`,
  }),
  pgPolicy("investor_payments_select", {
    for: "select",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = payments.loan_id AND loans.investor_id = auth.uid())`,
  }),
]);

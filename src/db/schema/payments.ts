import { pgTable, text, timestamp, numeric, uuid, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loans } from "./loans.js";
import { users } from "./users.js";
import { installments } from "./installments.js";
import { paymentVouchers } from "./payment-vouchers.js";

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  loanId: uuid("loan_id").notNull().references(() => loans.id),
  installmentId: uuid("installment_id").references(() => installments.id), // Opcional, si paga una cuota específica
  voucherId: uuid("voucher_id").references(() => paymentVouchers.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).defaultNow().notNull(),
  method: text("method", { enum: ["cash", "transfer", "deposit", "other"] }).notNull().default("cash"),
  reference: text("reference"), // Número de operación, etc.
  observation: text("observation"),
  registeredById: uuid("registered_by_id").notNull().references(() => users.id),
  status: text("status", { enum: ["confirmed", "reversed"] }).notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, () => [
  // RLS para Pagos
  pgPolicy("admin_payments_all", {
    for: "all",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true))`,
  }),
  pgPolicy("client_payments_select", {
    for: "select",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.client_id WHERE loans.id = payments.loan_id AND users.auth_user_id = auth.uid()::text)`,
  }),
  pgPolicy("investor_payments_select", {
    for: "select",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.investor_id WHERE loans.id = payments.loan_id AND users.auth_user_id = auth.uid()::text)`,
  }),
]);

import { pgTable, text, timestamp, numeric, uuid, pgPolicy, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loans } from "./loans.js";
import { users } from "./users.js";

export const paymentVouchers = pgTable("payment_vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  loanId: uuid("loan_id").notNull().references(() => loans.id),
  clientId: uuid("client_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  operationId: text("operation_id").notNull(), // ID de operación bancaria
  operationDate: timestamp("operation_date", { withTimezone: true }), // Fecha del voucher
  evidenceUrl: text("evidence_url"),
  status: text("status", { 
    enum: [
      "draft",
      "pending_investor_review", 
      "investor_approved", 
      "investor_rejected", 
      "owner_approved", 
      "owner_rejected",
      "deleted"
    ] 
  }).notNull().default("draft"),
  observation: text("observation"),
  processedById: uuid("processed_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  // Índice único para evitar duplicados de operation_id
  uniqueIndex("ui_operation_id").on(table.operationId),
  
  // RLS para Vouchers
  pgPolicy("admin_vouchers_all", {
    for: "all",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true))`,
  }),
  pgPolicy("client_vouchers_select", {
    for: "select",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = payment_vouchers.client_id AND users.auth_user_id = auth.uid()::text)`,
  }),
  pgPolicy("investor_vouchers_view", {
    for: "select",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.investor_id WHERE loans.id = payment_vouchers.loan_id AND users.auth_user_id = auth.uid()::text)`,
  }),
]);

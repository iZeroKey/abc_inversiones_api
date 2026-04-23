import { sql } from "drizzle-orm";
import {
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { loans } from "./loans.js";

export const installments = pgTable(
  "installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    installmentNumber: integer("installment_number").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    status: text("status", { enum: ["pending", "paid", "overdue"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS
    pgPolicy("admin_installments_all", {
      for: "all",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.is_owner = true))`,
    }),
    pgPolicy("client_installments_select", {
      for: "select",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = installments.loan_id AND loans.client_id = auth.uid())`,
    }),
    pgPolicy("investor_installments_select", {
      for: "select",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM loans WHERE loans.id = installments.loan_id AND loans.investor_id = auth.uid())`,
    }),
  ],
);

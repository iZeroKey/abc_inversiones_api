import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id),
    investorId: text("investor_id").references(() => users.id),
    principal: numeric("principal", { precision: 12, scale: 2 }).notNull(),
    interestRate: numeric("interest_rate", {
      precision: 5,
      scale: 2,
    }).notNull(),
    interestType: text("interest_type", { enum: ["simple", "compound"] })
      .notNull()
      .default("simple"),
    interestPeriod: text("interest_period", { enum: ["monthly", "annual"] })
      .notNull()
      .default("monthly"),
    installmentsCount: integer("installments_count").notNull(),
    frequency: text("frequency", {
      enum: ["daily", "weekly", "biweekly", "monthly"],
    })
      .notNull()
      .default("monthly"),
    paymentDay: integer("payment_day"),
    totalDebt: numeric("total_debt", { precision: 12, scale: 2 }).notNull(),
    status: text("status", {
      enum: [
        "draft",
        "pending_investor_review",
        "pending_admin_review",
        "active",
        "rejected",
        "paid",
        "defaulted",
      ],
    })
      .notNull()
      .default("draft"),
    isCompanyFunded: boolean("is_company_funded").notNull().default(false),
    startDate: timestamp("start_date", { withTimezone: true }),
    observation: text("observation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    // RLS
    pgPolicy("admin_loans_all", {
      for: "all",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.is_owner = true))`,
    }),
    pgPolicy("client_loans_select", {
      for: "select",
      to: "authenticated",
      using: sql`client_id = auth.uid()`,
    }),
    pgPolicy("investor_loans_select", {
      for: "select",
      to: "authenticated",
      using: sql`investor_id = auth.uid()`,
    }),
  ],
);

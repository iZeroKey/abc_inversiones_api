import { sql } from "drizzle-orm";
import {
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    roleRequested: text("role_requested", {
      enum: ["client", "investor"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "in_review", "approved", "rejected"],
    })
      .notNull()
      .default("pending"),
    additionalData: jsonb("additional_data").default({}),
    observation: text("observation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS
    pgPolicy("admin_access_requests_all", {
      for: "all",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.is_owner = true))`,
    }),
    pgPolicy("public_insert_access_requests", {
      for: "insert",
      to: "anon",
    }),
  ],
);

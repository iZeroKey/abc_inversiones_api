import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull(), // ej: 'LOAN_APPROVED', 'VOUCHER_REJECTED', 'SYSTEM'
    isRead: boolean("is_read").default(false).notNull(),
    data: text("data"), // JSON opcional para redirecciones en el app
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    pgPolicy("admin_notifications_all", {
      for: "all",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true))`,
    }),
    pgPolicy("user_notifications_self_select", {
      for: "select",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = notifications.user_id AND users.auth_user_id = auth.uid()::text)`,
    }),
  ],
);

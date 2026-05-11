import { sql } from "drizzle-orm";
import { jsonb, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  module: text("module").notNull(),
  entityId: text("entity_id"),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy("admin_audit_logs_all", {
    for: "all",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true))`,
  }),
  pgPolicy("user_audit_logs_self_select", {
    for: "select",
    to: "authenticated",
    using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = audit_logs.user_id AND users.auth_user_id = auth.uid()::text)`,
  }),
]);

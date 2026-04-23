import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(), // ej: 'LOAN_APPROVED', 'VOUCHER_REJECTED', 'SYSTEM'
  isRead: boolean("is_read").default(false).notNull(),
  data: text("data"), // JSON opcional para redirecciones en el app
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

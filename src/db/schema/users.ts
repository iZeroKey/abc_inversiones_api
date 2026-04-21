import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: text("role", { enum: ["client", "investor", "owner", "admin"] })
      .default("client")
      .notNull(),
    isOwner: boolean("is_owner").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    pgPolicy("users_self_select", {
      for: "select",
      using: sql`auth.uid() = ${t.id}`,
    }),
    pgPolicy("users_admin_all", {
      for: "all",
      using: sql`EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_owner = true)
      )`,
    }),
  ],
);

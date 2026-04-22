import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // UUID de Supabase Auth
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    role: text("role", { enum: ["admin", "client", "investor", "owner"] })
      .notNull()
      .default("client"),
    isOwner: boolean("is_owner").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // RLS
    pgPolicy("admin_all_access", {
      for: "all",
      to: "authenticated",
      using: sql`role = 'admin' OR is_owner = true`,
    }),
    pgPolicy("user_self_access", {
      for: "select",
      to: "authenticated",
      using: sql`id = auth.uid()`,
    }),
    pgPolicy("user_self_update", {
      for: "update",
      to: "authenticated",
      using: sql`id = auth.uid()`,
    }),
  ],
);

import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const textArray = customType<{ data: string[]; driverData: string[] }>({
  dataType() {
    return "text[]";
  },
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: text("auth_user_id"), // UUID de Supabase Auth cuando tiene cuenta
    publicCode: text("public_code"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").unique(),
    phone: text("phone"),
    dni: text("dni"),
    address: text("address"),
    bank: text("bank"),
    bankAccounts: textArray("bank_accounts")
      .notNull()
      .default(sql`'{}'::text[]`),
    maritalStatus: text("marital_status", {
      enum: ["single", "married", "unspecified"],
    }),
    avatarUrl: text("avatar_url"),
    role: text("role", { enum: ["admin", "client", "investor"] })
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
    uniqueIndex("users_auth_user_id_unique").on(table.authUserId),
    uniqueIndex("users_public_code_unique").on(table.publicCode),
    pgPolicy("admin_all_access", {
      for: "all",
      to: "authenticated",
      using: sql`EXISTS (SELECT 1 FROM users AS current_user WHERE current_user.auth_user_id = auth.uid()::text AND (current_user.role = 'admin' OR current_user.is_owner = true))`,
    }),
    pgPolicy("user_self_access", {
      for: "select",
      to: "authenticated",
      using: sql`auth_user_id = auth.uid()::text`,
    }),
  ],
);

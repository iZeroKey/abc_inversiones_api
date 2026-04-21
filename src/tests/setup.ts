import { execSync } from "child_process";
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, queryClient } from "../config/db.js";
import { supabaseAdmin } from "../config/supabase.js";
import { users } from "../db/schema/users.js";

export async function setup() {
  const testUrl = process.env.DATABASE_TEST_URL || process.env.DATABASE_URL;
  if (!testUrl) {
    console.warn("DATABASE_URL no definida. Saltando setup de DB.");
    return;
  }

  console.log("Configurando entorno de prueba...");

  try {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    if (listData?.users && listData.users.length > 0) {
      for (const user of listData.users) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }
    }

    await db.execute(sql`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    execSync("npx drizzle-kit push --force", {
      env: { ...process.env, DATABASE_URL: testUrl },
    });

    const testUsers = [
      {
        email: "admin@abc.com",
        password: "password123",
        firstName: "Admin",
        lastName: "ABC",
        role: "admin" as const,
        isOwner: true,
      },
      {
        email: "client@abc.com",
        password: "password123",
        firstName: "Cliente",
        lastName: "Test",
        role: "client" as const,
        isOwner: false,
      },
      {
        email: "investor@abc.com",
        password: "password123",
        firstName: "Inversor",
        lastName: "Test",
        role: "investor" as const,
        isOwner: false,
      },
    ];

    for (const u of testUsers) {
      const { data: authData, error: authErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
        });

      if (authErr) throw authErr;

      await db.insert(users).values({
        id: authData.user.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isOwner: u.isOwner,
        active: true,
      });
    }

    console.log("Entorno de prueba listo.");
  } catch (error) {
    console.error("Error en setup de pruebas:", error);
    throw error;
  }
}

export async function teardown() {
  try {
    await queryClient.end();
  } catch (error) {
    console.error("Error en teardown de pruebas:", error);
  }
}

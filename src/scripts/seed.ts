import "dotenv/config";
import { db } from "../config/db.js";
import { supabaseAdmin } from "../config/supabase.js";
import { users } from "../db/schema/users.js";

async function seed() {
  console.log("Sembrando base de datos...");

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
      lastName: "Prueba",
      role: "client" as const,
      isOwner: false,
    },
    {
      email: "investor@abc.com",
      password: "password123",
      firstName: "Inversor",
      lastName: "Prueba",
      role: "investor" as const,
      isOwner: false,
    },
  ];

  try {
    const {
      data: { users: authUsers },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    for (const userData of testUsers) {
      console.log(`Procesando: ${userData.email}`);

      let supabaseId: string;
      const existingAuthUser = authUsers.find(
        (u) => u.email === userData.email,
      );

      if (existingAuthUser) {
        supabaseId = existingAuthUser.id;
      } else {
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true,
          });

        if (authError) {
          console.error(
            `Error en Auth (${userData.email}):`,
            authError.message,
          );
          continue;
        }
        supabaseId = authUser.user.id;
      }

      const { password, ...localData } = userData;
      await db
        .insert(users)
        .values({
          ...localData,
          id: supabaseId,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            id: supabaseId,
            firstName: localData.firstName,
            lastName: localData.lastName,
            role: localData.role,
            isOwner: localData.isOwner,
          },
        });
    }

    console.log("Seed completado.");
  } catch (error) {
    console.error("Error en seed:", error);
  } finally {
    process.exit(0);
  }
}

seed();

import "dotenv/config";
import { db } from "../config/db.js";
import { supabaseAdmin } from "../config/supabase.js";
import { users } from "../db/schema/users.js";
import { eq } from "drizzle-orm";
import { generatePublicCodeForRole } from "../utils/public-code.util.js";

async function seed() {
  console.log("Sembrando base de datos...");

  const testUsers = [
    {
      email: "admin@abc.com",
      password: "password123",
      firstName: "Admin",
      lastName: "ABC",
      phone: "+51999888777",
      role: "admin" as const,
      isOwner: true,
    },
    {
      email: "client@abc.com",
      password: "password123",
      firstName: "Cliente",
      lastName: "Prueba",
      phone: "+51999111222",
      role: "client" as const,
      isOwner: false,
    },
    {
      email: "investor@abc.com",
      password: "password123",
      firstName: "Inversor",
      lastName: "Prueba",
      phone: "+51999333444",
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
            phone: userData.phone,
            phone_confirm: true,
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

      const localData = {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        isOwner: userData.isOwner,
      };
      const [existingLocalUser] = await db
        .select({ publicCode: users.publicCode })
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);
      const publicCode = existingLocalUser?.publicCode
        || await generatePublicCodeForRole(userData.role);

      await db
        .insert(users)
        .values({
          ...localData,
          id: supabaseId,
          publicCode,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            id: supabaseId,
            firstName: localData.firstName,
            lastName: localData.lastName,
            phone: localData.phone,
            role: localData.role,
            isOwner: localData.isOwner,
            publicCode,
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

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, queryClient } from "../config/db.js";
import { supabaseAdmin } from "../config/supabase.js";
import { users } from "../db/schema/users.js";
import { generatePublicCodeForRole } from "../utils/public-code.util.js";

type SeedUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "admin" | "client" | "investor";
  isOwner: boolean;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@abc.com",
    password: "password123",
    firstName: "Admin",
    lastName: "ABC",
    phone: "+51999888777",
    role: "admin",
    isOwner: true,
  },
  {
    email: "client@abc.com",
    password: "password123",
    firstName: "Cliente",
    lastName: "Prueba",
    phone: "+51999111222",
    role: "client",
    isOwner: false,
  },
  {
    email: "investor@abc.com",
    password: "password123",
    firstName: "Inversor",
    lastName: "Prueba",
    phone: "+51999333444",
    role: "investor",
    isOwner: false,
  },
];

async function getOrCreateAuthUser(
  email: string,
  password: string,
  phone: string,
): Promise<string> {
  const {
    data: { users: authUsers },
    error: listError,
  } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = authUsers.find((u) => u.email === email);
  if (existing) {
    return existing.id;
  }

  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone,
      phone_confirm: true,
    });

  if (authError || !authUser.user) {
    throw new Error(
      `Error creando usuario en Auth (${email}): ${authError?.message || "sin user"}`,
    );
  }

  return authUser.user.id;
}

async function upsertLocalUser(
  authUserId: string,
  userData: SeedUser,
): Promise<void> {
  const [existingUser] = await db
    .select({ publicCode: users.publicCode })
    .from(users)
    .where(eq(users.email, userData.email))
    .limit(1);

  const publicCode =
    existingUser?.publicCode ||
    (await generatePublicCodeForRole(userData.role));

  await db
    .insert(users)
    .values({
      authUserId,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      role: userData.role,
      isOwner: userData.isOwner,
      publicCode,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        authUserId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        isOwner: userData.isOwner,
        publicCode,
      },
    });
}

export async function seed(): Promise<void> {
  console.log("Sembrando base de datos...");

  for (const userData of SEED_USERS) {
    console.log(`  Procesando: ${userData.email}`);

    const authUserId = await getOrCreateAuthUser(
      userData.email,
      userData.password,
      userData.phone,
    );

    await upsertLocalUser(authUserId, userData);
    console.log(`  ✓ ${userData.email} (${userData.role})`);
  }

  console.log("Seed completado.");
}

const isDirectExecution =
  process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js");

if (isDirectExecution) {
  seed()
    .catch((error) => {
      console.error("Error en seed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await queryClient.end();
    });
}

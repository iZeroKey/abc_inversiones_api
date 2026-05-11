import "dotenv/config";

type Role = "admin" | "client" | "investor";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type SessionPayload = {
  session: {
    access_token: string;
  };
};

type UserPayload = {
  user: SeededUser;
};

type SeededUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: Role;
  publicCode?: string | null;
};

type SeedUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: Role;
};

const API_BASE_URL = (
  process.env.API_SEED_BASE_URL || "http://localhost:3000/api/v1"
).replace(/\/$/, "");

const OWNER_EMAIL = process.env.API_SEED_OWNER_EMAIL || "admin@abc.com";
const OWNER_PASSWORD = process.env.API_SEED_OWNER_PASSWORD || "password123";
const DEFAULT_PASSWORD = process.env.API_SEED_DEFAULT_PASSWORD || "password123";

const seedUsers: SeedUser[] = [
  {
    email: "api.admin@abc.com",
    password: DEFAULT_PASSWORD,
    firstName: "Admin",
    lastName: "API",
    phone: "+51999000001",
    role: "admin",
  },
  {
    email: "api.client@abc.com",
    password: DEFAULT_PASSWORD,
    firstName: "Cliente",
    lastName: "API",
    phone: "+51999000002",
    role: "client",
  },
  {
    email: "api.investor@abc.com",
    password: DEFAULT_PASSWORD,
    firstName: "Inversor",
    lastName: "API",
    phone: "+51999000003",
    role: "investor",
  },
];

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json() as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(`${response.status} ${payload.message}: ${JSON.stringify(payload.data)}`);
  }

  return payload;
}

async function login(email: string, password: string): Promise<string> {
  const response = await apiRequest<SessionPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return response.data.session.access_token;
}

async function getUsers(token: string): Promise<SeededUser[]> {
  const response = await apiRequest<SeededUser[]>("/users", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
}

async function createUser(token: string, user: SeedUser): Promise<SeededUser> {
  const response = await apiRequest<UserPayload>("/auth/register", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
    }),
  });

  return response.data.user;
}

async function updateUserProfile(
  token: string,
  id: string,
  user: SeedUser,
): Promise<SeededUser> {
  const response = await apiRequest<SeededUser>(`/users/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      active: true,
    }),
  });

  return response.data;
}

async function assertLogin(user: SeedUser): Promise<void> {
  try {
    await login(user.email, user.password);
    console.log(`   Login OK: ${user.email}`);
  } catch (error) {
    console.warn(
      `   Login omitido/fallido para ${user.email}. Si ya existía, su password no se modifica por seguridad.`,
    );
    console.warn(`   ${(error as Error).message}`);
  }
}

async function main(): Promise<void> {
  console.log(`Sembrando datos por API en ${API_BASE_URL}`);
  console.log(`Autenticando owner: ${OWNER_EMAIL}`);

  const ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  const existingUsers = await getUsers(ownerToken);

  for (const seedUser of seedUsers) {
    const existing = existingUsers.find((user) => user.email === seedUser.email);

    if (!existing) {
      const created = await createUser(ownerToken, seedUser);
      console.log(`Creado ${created.email} (${created.role}, ${created.publicCode})`);
      await assertLogin(seedUser);
      continue;
    }

    if (existing.role !== seedUser.role) {
      throw new Error(
        `El usuario ${seedUser.email} ya existe con rol ${existing.role}; no se cambia a ${seedUser.role}.`,
      );
    }

    const updated = await updateUserProfile(ownerToken, existing.id, seedUser);
    console.log(`Actualizado ${updated.email} (${updated.role}, ${updated.publicCode})`);
    await assertLogin(seedUser);
  }

  console.log("Seed por API completado.");
}

main().catch((error) => {
  console.error("Error en seed por API:", error);
  process.exitCode = 1;
});

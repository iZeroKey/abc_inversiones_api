import "dotenv/config";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type UserResponse = {
  id: string;
  publicCode: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
};

type LoanResponse = {
  id: string;
  publicCode: string | null;
  status: string;
  totalDebt?: string;
};

type DemoUser = {
  firstName: string;
  lastName: string;
  role: "client" | "investor";
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  address?: string | null;
  bank?: string | null;
  bankAccounts?: string[];
  maritalStatus?: "single" | "married" | "unspecified" | null;
  createAuthAccount?: boolean;
};

type DemoLoan = {
  clientIndex: number;
  investorIndex?: number;
  principal: string;
  interestRate: string;
  installmentsCount: number;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  startDate: string;
  observation: string;
  payments?: Array<{
    amount: string;
    paymentDate: string;
    method: "cash" | "transfer" | "deposit" | "other";
    reference: string;
    observation?: string;
  }>;
};

const API_BASE_URL =
  process.env.SEED_API_BASE_URL || "http://localhost:3000/api/v1";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@abc.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "password123";
const TEMP_PASSWORD = process.env.SEED_TEMP_PASSWORD || "ABC123password";
const NAMESPACE = process.env.SEED_DEMO_NAMESPACE || "demo";

const clients: DemoUser[] = [
  {
    firstName: "Valeria",
    lastName: "Salazar Rios",
    role: "client",
    email: `${NAMESPACE}.cliente1@abc.test`,
    phone: "+51940111222",
    dni: "45123987",
    address: "Av. Los Alamos 120",
    bank: "BCP",
    bankAccounts: ["191-1234567890", "002-191123456789012345"],
    maritalStatus: "single",
    createAuthAccount: true,
  },
  {
    firstName: "Marco",
    lastName: "Huaman Torres",
    role: "client",
    email: null,
    phone: "+51940222333",
    dni: "40881234",
    address: "Jr. Comercio 540",
    bank: "Interbank",
    bankAccounts: ["200-300400500"],
    maritalStatus: "married",
  },
  {
    firstName: "Rosa",
    lastName: "Quispe Leon",
    role: "client",
    email: `${NAMESPACE}.cliente2@abc.test`,
    phone: "+51940333444",
    dni: "70223344",
    address: "Calle Las Flores 88",
    bank: "BBVA",
    bankAccounts: ["0011-0222-033344"],
    maritalStatus: "unspecified",
    createAuthAccount: true,
  },
  {
    firstName: "Diego",
    lastName: "Mendoza Paredes",
    role: "client",
    email: null,
    phone: "+51940444555",
    dni: "48990123",
    address: "Av. Grau 1550",
    bank: "Scotiabank",
    bankAccounts: [],
    maritalStatus: null,
  },
];

const investors: DemoUser[] = [
  {
    firstName: "Camila",
    lastName: "Vargas Soto",
    role: "investor",
    email: `${NAMESPACE}.inversor1@abc.test`,
    phone: "+51950111222",
    dni: "40112233",
    address: "Av. Javier Prado 200",
    bank: "BCP",
    bankAccounts: ["191-555666777"],
    maritalStatus: "married",
    createAuthAccount: true,
  },
  {
    firstName: "Andres",
    lastName: "Lopez Aguilar",
    role: "investor",
    email: null,
    phone: "+51950222333",
    dni: "43334455",
    address: "Calle San Martin 304",
    bank: "Interbank",
    bankAccounts: ["898-123123123"],
    maritalStatus: "single",
  },
  {
    firstName: "Lucia",
    lastName: "Reyes Cardenas",
    role: "investor",
    email: `${NAMESPACE}.inversor2@abc.test`,
    phone: "+51950333444",
    dni: "46667788",
    address: "Av. Primavera 700",
    bank: "BBVA",
    bankAccounts: ["0011-9988776655"],
    maritalStatus: "unspecified",
    createAuthAccount: true,
  },
];

const demoLoans: DemoLoan[] = [
  {
    clientIndex: 0,
    investorIndex: 0,
    principal: "10000.00",
    interestRate: "5.00",
    installmentsCount: 12,
    frequency: "monthly",
    startDate: "2026-05-08T00:00:00.000-05:00",
    observation: "Capital de trabajo",
    payments: [
      {
        amount: "1128.25",
        paymentDate: "2026-06-08T05:00:00.000Z",
        method: "transfer",
        reference: "DEMO-PAGO-001",
        observation: "Primera cuota registrada por admin",
      },
    ],
  },
  {
    clientIndex: 1,
    investorIndex: 1,
    principal: "3500.00",
    interestRate: "4.00",
    installmentsCount: 8,
    frequency: "weekly",
    startDate: "2026-05-11T00:00:00.000-05:00",
    observation: "Compra de mercaderia",
    payments: [
      {
        amount: "400.00",
        paymentDate: "2026-05-18T05:00:00.000Z",
        method: "cash",
        reference: "DEMO-PAGO-002",
      },
    ],
  },
  {
    clientIndex: 2,
    investorIndex: 2,
    principal: "7200.00",
    interestRate: "3.50",
    installmentsCount: 10,
    frequency: "biweekly",
    startDate: "2026-05-15T00:00:00.000-05:00",
    observation: "Financiamiento de inventario",
  },
  {
    clientIndex: 3,
    principal: "1800.00",
    interestRate: "6.00",
    installmentsCount: 6,
    frequency: "daily",
    startDate: "2026-05-11T00:00:00.000-05:00",
    observation: "Prestamo operativo sin inversionista asignado",
  },
];

async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(
      `${response.status} ${body.message || response.statusText}: ${JSON.stringify(body.data)}`,
    );
  }

  return body.data;
}

async function login(): Promise<string> {
  const data = await api<{ session: { access_token: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  return data.session.access_token;
}

async function createUser(
  token: string,
  user: DemoUser,
): Promise<UserResponse> {
  return api<UserResponse>("/users", {
    method: "POST",
    token,
    body: JSON.stringify({
      ...user,
      password: user.createAuthAccount ? TEMP_PASSWORD : undefined,
    }),
  });
}

async function createAndApproveLoan(
  token: string,
  loan: DemoLoan,
  createdClients: UserResponse[],
  createdInvestors: UserResponse[],
): Promise<LoanResponse> {
  const created = await api<LoanResponse>("/loans", {
    method: "POST",
    token,
    body: JSON.stringify({
      clientId: createdClients[loan.clientIndex].id,
      investorId:
        loan.investorIndex === undefined
          ? null
          : createdInvestors[loan.investorIndex].id,
      principal: loan.principal,
      interestRate: loan.interestRate,
      installmentsCount: loan.installmentsCount,
      frequency: loan.frequency,
      startDate: loan.startDate,
      observation: loan.observation,
    }),
  });

  const activated = await api<{ loan: LoanResponse }>(
    `/loans/${created.id}/approve`,
    {
      method: "PATCH",
      token,
    },
  );

  for (const payment of loan.payments || []) {
    await api("/payments", {
      method: "POST",
      token,
      body: JSON.stringify({
        loanId: activated.loan.id,
        ...payment,
      }),
    });
  }

  return activated.loan;
}

async function main() {
  const token = await login();
  const createdClients: UserResponse[] = [];
  const createdInvestors: UserResponse[] = [];
  const createdLoans: LoanResponse[] = [];

  for (const client of clients) {
    createdClients.push(await createUser(token, client));
  }

  for (const investor of investors) {
    createdInvestors.push(await createUser(token, investor));
  }

  for (const loan of demoLoans) {
    createdLoans.push(
      await createAndApproveLoan(token, loan, createdClients, createdInvestors),
    );
  }

  console.log("Seed demo API finalizado");
  console.log(`Clientes creados: ${createdClients.length}`);
  console.log(`Inversionistas creados: ${createdInvestors.length}`);
  console.log(`Prestamos creados: ${createdLoans.length}`);
  console.log(
    `Pagos registrados: ${demoLoans.reduce((total, loan) => total + (loan.payments?.length || 0), 0)}`,
  );
}

main().catch((error) => {
  console.error("Error en seed demo API:", error);
  process.exit(1);
});

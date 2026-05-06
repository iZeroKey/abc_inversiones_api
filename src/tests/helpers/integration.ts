import { eq } from "drizzle-orm";
import supertest from "supertest";
import { app } from "../../app.js";
import { db } from "../../config/db.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { accessRequests } from "../../db/schema/access-requests.js";
import { auditLogs } from "../../db/schema/audit-logs.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { notifications } from "../../db/schema/notifications.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { users } from "../../db/schema/users.js";
import { generatePublicCode, generatePublicCodeForRole } from "../../utils/public-code.util.js";

export const request = supertest(app);

export const TEST_PASSWORD = "password123";

export const seededEmails = {
  admin: "admin@abc.com",
  client: "client@abc.com",
  investor: "investor@abc.com",
} as const;

export const uniqueEmail = (prefix: string): string => {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@abc.com`;
};

export const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const loginAs = async (
  email: string,
  password = TEST_PASSWORD,
): Promise<string> => {
  const res = await request
    .post("/api/v1/auth/login")
    .send({ email, password });

  if (res.status !== 200) {
    throw new Error(`No se pudo iniciar sesión para ${email}: ${res.status} ${res.text}`);
  }

  return res.body.data.session.access_token as string;
};

export const getUserByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
};

export const createAuthUser = async (params: {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: "admin" | "client" | "investor";
  isOwner?: boolean;
  phone?: string;
}) => {
  const password = params.password || TEST_PASSWORD;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password,
    email_confirm: true,
    phone: params.phone,
    phone_confirm: !!params.phone,
  });

  if (error || !data.user) {
    throw new Error(`Error creando usuario de prueba: ${error?.message || "sin user"}`);
  }

  const [created] = await db.insert(users).values({
    id: data.user.id,
    email: params.email,
    firstName: params.firstName,
    lastName: params.lastName,
    phone: params.phone,
    role: params.role,
    isOwner: params.isOwner || false,
    publicCode: await generatePublicCodeForRole(params.role),
    active: true,
  }).returning();

  return { ...created, password };
};

export const createLoanFixture = async (params: {
  clientId: string;
  investorId?: string | null;
  status?: typeof loans.$inferInsert.status;
  principal?: string;
  interestRate?: string;
  installmentsCount?: number;
  totalDebt?: string;
  frequency?: "daily" | "weekly" | "biweekly" | "monthly";
  isCompanyFunded?: boolean;
  paymentDay?: number | null;
  startDate?: Date;
  observation?: string | null;
}) => {
  const [loan] = await db.insert(loans).values({
    clientId: params.clientId,
    investorId: params.investorId || null,
    publicCode: await generatePublicCode("loan"),
    principal: params.principal || "1000.00",
    interestRate: params.interestRate || "5.00",
    installmentsCount: params.installmentsCount || 4,
    totalDebt: params.totalDebt || "1200.00",
    frequency: params.frequency || "monthly",
    interestType: "simple",
    interestPeriod: "monthly",
    status: params.status || "active",
    isCompanyFunded: params.isCompanyFunded ?? !params.investorId,
    paymentDay: params.paymentDay ?? 15,
    startDate: params.startDate || new Date("2026-01-01T00:00:00.000Z"),
    observation: params.observation || null,
  }).returning();

  return loan;
};

export const createInstallmentFixture = async (params: {
  loanId: string;
  installmentNumber: number;
  amount?: string;
  paidAmount?: string;
  status?: "pending" | "paid" | "overdue";
  dueDate?: Date;
}) => {
  const [installment] = await db.insert(installments).values({
    loanId: params.loanId,
    installmentNumber: params.installmentNumber,
    amount: params.amount || "300.00",
    paidAmount: params.paidAmount || "0.00",
    status: params.status || "pending",
    dueDate: params.dueDate || new Date("2026-02-01T00:00:00.000Z"),
  }).returning();

  return installment;
};

export const createNotificationFixture = async (params: {
  userId: string;
  title?: string;
  body?: string;
  type?: string;
  isRead?: boolean;
  data?: string | null;
  createdAt?: Date;
}) => {
  const [notification] = await db.insert(notifications).values({
    userId: params.userId,
    title: params.title || "Notificación test",
    body: params.body || "Contenido test",
    type: params.type || "SYSTEM",
    isRead: params.isRead ?? false,
    data: params.data || null,
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  }).returning();

  return notification;
};

export const createAuditLogFixture = async (params: {
  userId: string;
  action: string;
  module: string;
  entityId?: string | null;
}) => {
  const [log] = await db.insert(auditLogs).values({
    userId: params.userId,
    action: params.action,
    module: params.module,
    entityId: params.entityId || null,
  }).returning();

  return log;
};

export const createAccessRequestFixture = async (params: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  roleRequested: "client" | "investor";
}) => {
  const [requestRow] = await db.insert(accessRequests).values(params).returning();
  return requestRow;
};

export const createVoucherFixture = async (params: {
  loanId: string;
  clientId: string;
  amount?: string;
  operationId: string;
  status?: "draft" | "pending_investor_review" | "investor_approved" | "investor_rejected" | "owner_approved" | "owner_rejected";
}) => {
  const [voucher] = await db.insert(paymentVouchers).values({
    loanId: params.loanId,
    clientId: params.clientId,
    amount: params.amount || "500.00",
    operationId: params.operationId,
    operationDate: new Date("2026-04-06T00:00:00.000Z"),
    status: params.status || "pending_investor_review",
  }).returning();

  return voucher;
};

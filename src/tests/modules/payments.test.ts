import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import {
  authHeader,
  createInstallmentFixture,
  createLoanFixture,
  getUserByEmail,
  loginAs,
  request,
  seededEmails,
} from "../helpers/integration.js";

describe("Payments Module", () => {
  it("debería permitir registrar un pago manual", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "active",
      isCompanyFunded: true,
      totalDebt: "1200.00",
      installmentsCount: 4,
    });

    await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 1,
      amount: "300.00",
      status: "pending",
    });

    const res = await request
      .post("/api/v1/payments")
      .set(authHeader(adminToken))
      .send({ loanId: loan.id, amount: "100", method: "cash" });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe("100.00");
  });

  it("debería aplicar un pago a una cuota overdue", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "active",
      isCompanyFunded: true,
      totalDebt: "200.00",
      installmentsCount: 2,
    });
    const overdue = await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 1,
      amount: "100.00",
      status: "overdue",
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 2,
      amount: "100.00",
      status: "pending",
      dueDate: new Date("2026-12-01T00:00:00.000Z"),
    });

    const res = await request
      .post("/api/v1/payments")
      .set(authHeader(adminToken))
      .send({ loanId: loan.id, amount: "100.00", method: "cash" });

    const [updatedOverdue] = await db
      .select()
      .from(installments)
      .where(eq(installments.id, overdue.id))
      .limit(1);

    expect(res.status).toBe(201);
    expect(updatedOverdue.paidAmount).toBe("100.00");
    expect(updatedOverdue.status).toBe("paid");
  });

  it("debería mantener overdue en un pago parcial de cuota vencida", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "active",
      isCompanyFunded: true,
      totalDebt: "100.00",
      installmentsCount: 1,
    });
    const overdue = await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 1,
      amount: "100.00",
      paidAmount: "20.00",
      status: "overdue",
      dueDate: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request
      .post("/api/v1/payments")
      .set(authHeader(adminToken))
      .send({ loanId: loan.id, amount: "30.00", method: "cash" });

    const [updatedOverdue] = await db
      .select()
      .from(installments)
      .where(eq(installments.id, overdue.id))
      .limit(1);

    expect(res.status).toBe(201);
    expect(updatedOverdue.paidAmount).toBe("50.00");
    expect(updatedOverdue.status).toBe("overdue");
  });

  it("debería marcar cuotas y préstamo como pagados con un pago exacto", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "active",
      isCompanyFunded: true,
      totalDebt: "200.00",
      installmentsCount: 2,
    });
    await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 1,
      amount: "100.00",
      status: "overdue",
    });
    await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 2,
      amount: "100.00",
      status: "pending",
    });

    const res = await request
      .post("/api/v1/payments")
      .set(authHeader(adminToken))
      .send({ loanId: loan.id, amount: "200.00", method: "cash" });

    const updatedInstallments = await db
      .select()
      .from(installments)
      .where(eq(installments.loanId, loan.id));
    const [updatedLoan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loan.id))
      .limit(1);

    expect(res.status).toBe(201);
    expect(updatedInstallments.every((installment) => installment.status === "paid")).toBe(true);
    expect(updatedLoan.status).toBe("paid");
  });

  it("debería rechazar sobrepagos con 400", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "active",
      isCompanyFunded: true,
      totalDebt: "100.00",
      installmentsCount: 1,
    });
    await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 1,
      amount: "100.00",
      status: "pending",
    });

    const res = await request
      .post("/api/v1/payments")
      .set(authHeader(adminToken))
      .send({ loanId: loan.id, amount: "100.01", method: "cash" });

    expect(res.status).toBe(400);
  });

  it("debería devolver 404 al pagar un préstamo inexistente", async () => {
    const adminToken = await loginAs(seededEmails.admin);

    const res = await request
      .post("/api/v1/payments")
      .set(authHeader(adminToken))
      .send({
        loanId: "00000000-0000-4000-8000-000000000001",
        amount: "100.00",
        method: "cash",
      });

    expect(res.status).toBe(404);
  });

  it("debería devolver 400 al pagar un préstamo no activo", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "draft",
      isCompanyFunded: true,
      totalDebt: "100.00",
      installmentsCount: 1,
    });
    await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 1,
      amount: "100.00",
      status: "pending",
    });

    const res = await request
      .post("/api/v1/payments")
      .set(authHeader(adminToken))
      .send({ loanId: loan.id, amount: "100.00", method: "cash" });

    expect(res.status).toBe(400);
  });

  it("debería impedir ver pagos de un préstamo sin acceso", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
    });

    const res = await request
      .get(`/api/v1/payments/loan/${loan.id}`)
      .set(authHeader(await loginAs(seededEmails.investor)));

    expect(res.status).toBe(403);
  });
});

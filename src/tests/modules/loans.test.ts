import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { db } from "../../config/db.js";
import { installments } from "../../db/schema/installments.js";
import { loans } from "../../db/schema/loans.js";
import { BUSINESS_TIMEZONE } from "../../modules/loans/loans.schedule.js";
import { authHeader, createAuthUser, createLoanFixture, getUserByEmail, loginAs, request, seededEmails, uniqueEmail } from "../helpers/integration.js";

describe("Loans Module", () => {
  it("debería permitir a un admin crear un préstamo", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);

    const res = await request
      .post("/api/v1/loans")
      .set(authHeader(adminToken))
      .send({
        clientId: client!.id,
        principal: "1000",
        interestRate: "5",
        installmentsCount: 12,
        frequency: "monthly",
        startDate: "2026-01-31T00:00:00.000-05:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.clientId).toBe(client!.id);
    expect(res.body.data.publicCode).toMatch(/^PR-\d{5}$/);
    expect(res.body.data.clientCode).toBe("CL-00001");
    expect(res.body.data.clientName).toBe(`${client!.firstName} ${client!.lastName}`);
    expect(res.body.data.status).toBe("pending_admin_review");
    expect(res.body.data.totalDebt).toBe("1353.90");
  });

  it("debería generar cronograma mensual desde startDate al aprobar finalmente", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "pending_admin_review",
      isCompanyFunded: true,
      installmentsCount: 4,
      frequency: "monthly",
      paymentDay: 15,
      startDate: new Date("2026-01-31T00:00:00.000-05:00"),
    });

    const res = await request
      .patch(`/api/v1/loans/${loan.id}/approve`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);

    const generatedInstallments = await db
      .select()
      .from(installments)
      .where(eq(installments.loanId, loan.id))
      .orderBy(installments.installmentNumber);

    expect(
      generatedInstallments.map((installment) =>
        DateTime.fromJSDate(installment.dueDate, {
          zone: BUSINESS_TIMEZONE,
        }).toISODate(),
      ),
    ).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("debería permitir que un admin active directamente un préstamo pendiente de inversionista", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor!.id,
      status: "pending_investor_review",
      isCompanyFunded: false,
      principal: "10000.00",
      interestRate: "5.00",
      totalDebt: "0.00",
      installmentsCount: 12,
      frequency: "daily",
      startDate: new Date("2026-05-08T00:00:00.000-05:00"),
    });

    const res = await request
      .patch(`/api/v1/loans/${loan.id}/approve`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.loan.status).toBe("active");
    expect(res.body.data.loan.totalDebt).toBe("13539.05");
    expect(res.body.data.loan.publicCode).toMatch(/^PR-\d{5}$/);
    expect(res.body.data.loan.clientCode).toBe("CL-00001");
    expect(res.body.data.loan.investorCode).toBe("IN-00001");

    const [updatedLoan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loan.id))
      .limit(1);
    const generatedInstallments = await db
      .select()
      .from(installments)
      .where(eq(installments.loanId, loan.id))
      .orderBy(installments.installmentNumber);

    expect(updatedLoan.totalDebt).toBe("13539.05");
    expect(generatedInstallments).toHaveLength(12);
    expect(generatedInstallments.at(0)?.amount).toBe("1128.25");
    expect(generatedInstallments.at(-1)?.amount).toBe("1128.30");
    expect(
      generatedInstallments.map((installment) =>
        DateTime.fromJSDate(installment.dueDate, {
          zone: BUSINESS_TIMEZONE,
        }).toISODate(),
      ),
    ).toEqual([
      "2026-05-10",
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
      "2026-05-14",
      "2026-05-15",
      "2026-05-16",
      "2026-05-17",
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
    ]);
  });

  it("debería permitir rechazar un préstamo en revisión", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "pending_admin_review",
      isCompanyFunded: true,
      investorId: null,
    });

    const res = await request
      .patch(`/api/v1/loans/${loan.id}/reject`)
      .set(authHeader(adminToken))
      .send({ observation: "No cumple requisitos" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("rejected");
  });

  it("debería exponer el resumen administrativo de préstamos", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "active",
      isCompanyFunded: true,
      investorId: null,
      principal: "1000.00",
      totalDebt: "1200.00",
      installmentsCount: 4,
    });

    await db.insert(installments).values([
      {
        loanId: loan.id,
        installmentNumber: 1,
        dueDate: new Date("2026-02-01T00:00:00.000-05:00"),
        amount: "300.00",
        paidAmount: "300.00",
        status: "paid",
      },
      {
        loanId: loan.id,
        installmentNumber: 2,
        dueDate: new Date("2026-03-01T00:00:00.000-05:00"),
        amount: "300.00",
        paidAmount: "0.00",
        status: "pending",
      },
    ]);

    const res = await request
      .get("/api/v1/loans/admin-summary")
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    const row = res.body.data.find((item: { id: string }) => item.id === loan.id);
    expect(row).toMatchObject({
      id: loan.id,
      publicCode: loan.publicCode,
      clientId: client!.id,
      clientCode: "CL-00001",
      clientName: `${client!.firstName} ${client!.lastName}`,
      paidAmount: "300.00",
      totalInterest: "200.00",
      remainingDebt: "300.00",
      remainingInstallments: 1,
    });
  });

  it("debería buscar préstamos por código público de préstamo, cliente e inversionista", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor!.id,
      status: "active",
      isCompanyFunded: false,
    });

    for (const term of [loan.publicCode, client!.publicCode, investor!.publicCode]) {
      const res = await request
        .get("/api/v1/loans")
        .query({ search: term })
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.some((item: { id: string }) => item.id === loan.id)).toBe(true);
    }
  });

  it("debería rechazar el rechazo de un préstamo pagado", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "paid",
      isCompanyFunded: true,
      investorId: null,
    });

    const res = await request
      .patch(`/api/v1/loans/${loan.id}/reject`)
      .set(authHeader(adminToken))
      .send({ observation: "Intento inválido" });

    expect(res.status).toBe(400);
  });

  it("debería impedir que un cliente vea el detalle de un préstamo ajeno", async () => {
    const otherClient = await createAuthUser({
      email: uniqueEmail("loan-other-client"),
      firstName: "Otro",
      lastName: "Cliente",
      role: "client",
    });
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: otherClient.id,
      investorId: investor!.id,
      status: "active",
      isCompanyFunded: false,
    });

    const res = await request
      .get(`/api/v1/loans/${loan.id}`)
      .set(authHeader(await loginAs(seededEmails.investor)));

    expect(res.status).toBe(200);

    const clientRes = await request
      .get(`/api/v1/loans/${loan.id}`)
      .set(authHeader(await loginAs(seededEmails.client)));

    expect(clientRes.status).toBe(403);
  });

  it("debería impedir acceder al cronograma de un préstamo sin permisos", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
    });

    const investorRes = await request
      .get(`/api/v1/loans/${loan.id}/installments`)
      .set(authHeader(await loginAs(seededEmails.investor)));

    expect(investorRes.status).toBe(403);
  });
});

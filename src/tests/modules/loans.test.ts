import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { db } from "../../config/db.js";
import { installments } from "../../db/schema/installments.js";
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
        interestType: "simple",
        interestPeriod: "monthly",
        startDate: "2026-01-31T00:00:00.000-05:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.clientId).toBe(client!.id);
    expect(res.body.data.status).toBe("pending_admin_review");
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

  it("debería rechazar el rechazo de un préstamo activo", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "active",
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

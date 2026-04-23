import { describe, expect, it } from "vitest";
import { authHeader, createLoanFixture, getUserByEmail, loginAs, request, seededEmails } from "../helpers/integration.js";

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
      });

    expect(res.status).toBe(201);
    expect(res.body.data.clientId).toBe(client!.id);
    expect(res.body.data.status).toBe("pending_admin_review");
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
});

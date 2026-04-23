import { describe, expect, it } from "vitest";
import { authHeader, createInstallmentFixture, createLoanFixture, getUserByEmail, loginAs, request, seededEmails } from "../helpers/integration.js";

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
});

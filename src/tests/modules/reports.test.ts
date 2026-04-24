import { describe, expect, it } from "vitest";
import {
  authHeader,
  createAuthUser,
  createLoanFixture,
  loginAs,
  request,
  seededEmails,
  uniqueEmail,
} from "../helpers/integration.js";

describe("Reports Module", () => {
  it("debería impedir que un inversionista consulte statement", async () => {
    const res = await request
      .get("/api/v1/reports/statement")
      .set(authHeader(await loginAs(seededEmails.investor)));

    expect(res.status).toBe(403);
  });

  it("debería impedir que un cliente consulte portfolio", async () => {
    const res = await request
      .get("/api/v1/reports/portfolio")
      .set(authHeader(await loginAs(seededEmails.client)));

    expect(res.status).toBe(403);
  });

  it("debería impedir que un cliente consulte statement de otro cliente", async () => {
    const otherClient = await createAuthUser({
      email: uniqueEmail("reports-client"),
      firstName: "Otro",
      lastName: "Cliente",
      role: "client",
    });

    const res = await request
      .get(`/api/v1/reports/statement/${otherClient.id}`)
      .set(authHeader(await loginAs(seededEmails.client)));

    expect(res.status).toBe(403);
  });

  it("debería permitir que admin consulte statement y portfolio por id", async () => {
    const client = await createAuthUser({
      email: uniqueEmail("reports-admin-client"),
      firstName: "Cliente",
      lastName: "AdminView",
      role: "client",
    });

    const investor = await createAuthUser({
      email: uniqueEmail("reports-admin-investor"),
      firstName: "Investor",
      lastName: "AdminView",
      role: "investor",
    });

    await createLoanFixture({
      clientId: client.id,
      investorId: investor.id,
      status: "active",
      isCompanyFunded: false,
    });

    const adminToken = await loginAs(seededEmails.admin);

    const statementRes = await request
      .get(`/api/v1/reports/statement/${client.id}`)
      .set(authHeader(adminToken));

    const portfolioRes = await request
      .get(`/api/v1/reports/portfolio/${investor.id}`)
      .set(authHeader(adminToken));

    expect(statementRes.status).toBe(200);
    expect(portfolioRes.status).toBe(200);
  });
});

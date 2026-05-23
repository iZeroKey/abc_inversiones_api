import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../config/db.js";
import { loans } from "../../db/schema/loans.js";
import { payments } from "../../db/schema/payments.js";
import {
  authHeader,
  createAuthUser,
  createLoanFixture,
  getUserByEmail,
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

  it("debería excluir préstamos eliminados y pagos revertidos del statement", async () => {
    const client = await createAuthUser({
      email: uniqueEmail("reports-filter-client"),
      firstName: "Cliente",
      lastName: "Filtros",
      role: "client",
    });
    const admin = await getUserByEmail(seededEmails.admin);
    const activeLoan = await createLoanFixture({
      clientId: client.id,
      status: "active",
      isCompanyFunded: true,
      totalDebt: "100.00",
    });
    const deletedLoan = await createLoanFixture({
      clientId: client.id,
      status: "active",
      isCompanyFunded: true,
      principal: "999.00",
      totalDebt: "999.00",
    });

    await db
      .update(loans)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(loans.id, deletedLoan.id));
    await db.insert(payments).values({
      loanId: activeLoan.id,
      amount: "50.00",
      method: "cash",
      registeredById: admin!.id,
      status: "reversed",
      deletedAt: new Date(),
    });

    const res = await request
      .get(`/api/v1/reports/statement/${client.id}`)
      .set(authHeader(await loginAs(seededEmails.admin)));

    expect(res.status).toBe(200);
    expect(
      res.body.data.loans.some(
        (loan: { id: string }) => loan.id === deletedLoan.id,
      ),
    ).toBe(false);
    expect(res.body.data.summary.totalPaid).toBe("0");
  });
});

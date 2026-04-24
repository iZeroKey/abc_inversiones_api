import { describe, expect, it } from "vitest";
import { authHeader, createLoanFixture, createVoucherFixture, getUserByEmail, loginAs, request, seededEmails } from "../helpers/integration.js";

describe("Payment Vouchers Module", () => {
  it("debería permitir al cliente subir un voucher a un préstamo activo", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor!.id,
      status: "active",
      isCompanyFunded: false,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({ loanId: loan.id, amount: "500", operationId: `OP-${Date.now()}` });

    expect(res.status).toBe(201);
    expect(res.body.data.loanId).toBe(loan.id);
  });

  it("debería rechazar análisis OCR cuando no se adjunta imagen", async () => {
    const res = await request
      .post("/api/v1/payment-vouchers/analyze")
      .set(authHeader(await loginAs(seededEmails.client)));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("evidence");
  });

  it("debería permitir al cliente subir un voucher adjuntando una imagen como evidencia", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor!.id,
      status: "active",
      isCompanyFunded: false,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .field("loanId", loan.id)
      .field("amount", "500")
      .field("operationId", `OP-UP-${Date.now()}`)
      .attach("evidence", Buffer.from("fake-image-content"), "voucher.png");

    expect(res.status).toBe(201);
    expect(res.body.data.evidenceUrl).toContain("token=");
  });

  it("debería responder 409 si la base rechaza un operationId duplicado", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor!.id,
      status: "active",
      isCompanyFunded: false,
    });
    const duplicatedOperationId = `OP-DUP-${Date.now()}`;

    await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: duplicatedOperationId,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({ loanId: loan.id, amount: "500", operationId: duplicatedOperationId });

    expect(res.status).toBe(409);
  });

  it("debería rechazar un voucher si el préstamo no está activo", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      status: "pending_admin_review",
      isCompanyFunded: true,
      investorId: null,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({ loanId: loan.id, amount: "500", operationId: `OP-INACTIVE-${Date.now()}` });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("activos");
  });

  it("debería permitir aprobación del inversionista", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor!.id,
      status: "active",
      isCompanyFunded: false,
    });
    const voucher = await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: `OP-INV-${Date.now()}`,
      status: "pending_investor_review",
    });

    const res = await request
      .patch(`/api/v1/payment-vouchers/${voucher.id}/process`)
      .set(authHeader(await loginAs(seededEmails.investor)))
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("investor_approved");
  });

  it("debería impedir al admin aprobar sin aprobación previa del inversionista", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const investor = await getUserByEmail(seededEmails.investor);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor!.id,
      status: "active",
      isCompanyFunded: false,
    });
    const voucher = await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: `OP-ADM-${Date.now()}`,
      status: "pending_investor_review",
    });

    const res = await request
      .patch(`/api/v1/payment-vouchers/${voucher.id}/process`)
      .set(authHeader(await loginAs(seededEmails.admin)))
      .send({ action: "approve" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("inversionista debe aprobar");
  });

  it("debería impedir que un inversionista procese un voucher de un préstamo no asignado", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
    });
    const voucher = await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: `OP-NOT-ASSIGNED-${Date.now()}`,
      status: "pending_investor_review",
    });

    const res = await request
      .patch(`/api/v1/payment-vouchers/${voucher.id}/process`)
      .set(authHeader(await loginAs(seededEmails.investor)))
      .send({ action: "approve" });

    expect(res.status).toBe(403);
  });
});

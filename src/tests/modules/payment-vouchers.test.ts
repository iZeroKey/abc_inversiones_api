import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { users } from "../../db/schema/users.js";
import { generatePublicCodeForRole } from "../../utils/public-code.util.js";
import { authHeader, createAuthUser, createInstallmentFixture, createLoanFixture, createVoucherFixture, getUserByEmail, loginAs, request, seededEmails, uniqueEmail } from "../helpers/integration.js";

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
    expect(res.body.data.status).toBe("pending_investor_review");
  });

  it("debería enviar el voucher directo a revisión admin si el inversionista no tiene cuenta de acceso", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const [investorWithoutAccess] = await db.insert(users).values({
      firstName: "Inversionista",
      lastName: "Sin Acceso",
      role: "investor",
      publicCode: await generatePublicCodeForRole("investor"),
      active: true,
    }).returning();
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investorWithoutAccess.id,
      status: "active",
      isCompanyFunded: false,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({ loanId: loan.id, amount: "500", operationId: `OP-NO-ACCESS-${Date.now()}` });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending_admin_review");
  });

  it("debería mover vouchers pendientes a revisión admin cuando se quita acceso al inversionista", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const investor = await createAuthUser({
      email: uniqueEmail("voucher-access-investor"),
      firstName: "Investor",
      lastName: "Access",
      role: "investor",
    });
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: investor.id,
      status: "active",
      isCompanyFunded: false,
    });
    const voucher = await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: `OP-MOVE-ADMIN-${Date.now()}`,
      status: "pending_investor_review",
    });

    const res = await request
      .patch(`/api/v1/users/${investor.id}`)
      .set(authHeader(await loginAs(seededEmails.admin)))
      .send({ active: false });

    expect(res.status).toBe(200);

    const [updatedVoucher] = await db
      .select()
      .from(paymentVouchers)
      .where(eq(paymentVouchers.id, voucher.id))
      .limit(1);

    expect(updatedVoucher.status).toBe("pending_admin_review");
  });

  it("debería rechazar método de pago enviado por el cliente en vouchers", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({
        loanId: loan.id,
        amount: "500",
        operationId: `OP-METHOD-${Date.now()}`,
        method: "cash",
      });

    expect(res.status).toBe(400);
  });

  it("debería validar rápidamente si un operationId ya existe", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
    });
    const existingOperationId = `OPCHECK${Date.now()}`;

    await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: existingOperationId,
    });

    const res = await request
      .get("/api/v1/payment-vouchers/operation-id/exists")
      .set(authHeader(await loginAs(seededEmails.client)))
      .query({ operationId: `  op-check ${existingOperationId.slice(7)}  ` });

    expect(res.status).toBe(200);
    expect(res.body.data.exists).toBe(true);
    expect(res.body.data.operationId).toBe(existingOperationId);
  });

  it("debería rechazar análisis OCR cuando no se adjunta imagen", async () => {
    const res = await request
      .post("/api/v1/payment-vouchers/analyze")
      .set(authHeader(await loginAs(seededEmails.client)));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("evidence");
  });

  it("debería rechazar vouchers con fecha de operación futura", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
    });

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({
        loanId: loan.id,
        amount: "500",
        operationId: `OPFUT${Date.now()}`,
        operationDate: futureDate,
      });

    expect(res.status).toBe(400);
      expect(res.body.message).toContain("futura");
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
    const duplicatedOperationId = `OPDUP${Date.now()}`;

    await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: duplicatedOperationId,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({ loanId: loan.id, amount: "500", operationId: `  op dup ${duplicatedOperationId.slice(5)}  ` });

    expect(res.status).toBe(409);
  });

  it("debería normalizar el operationId antes de guardar y detectar duplicados con variaciones", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
    });
    const normalizedOperationId = `OPVAR${Date.now()}`;

    await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      operationId: normalizedOperationId,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set(authHeader(await loginAs(seededEmails.client)))
      .send({
        loanId: loan.id,
        amount: "500",
        operationId: `op var ${normalizedOperationId.slice(5)}`,
      });

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

  it("debería permitir al cliente editar y eliminar un voucher pendiente", async () => {
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
      operationId: `OP-PENDING-${Date.now()}`,
      status: "pending_investor_review",
    });
    const token = await loginAs(seededEmails.client);

    const edited = await request
      .patch(`/api/v1/payment-vouchers/${voucher.id}`)
      .set(authHeader(token))
      .send({ amount: "250.00", observation: "Corrección" });
    expect(edited.status).toBe(200);
    expect(edited.body.data.voucher.amount).toBe("250.00");

    const deleted = await request
      .delete(`/api/v1/payment-vouchers/${voucher.id}`)
      .set(authHeader(token));
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.voucher.status).toBe("deleted");
  });

  it("debería eliminar un voucher aprobado y recalcular el pago aplicado", async () => {
    const adminToken = await loginAs(seededEmails.admin);
    const client = await getUserByEmail(seededEmails.client);
    const loan = await createLoanFixture({
      clientId: client!.id,
      investorId: null,
      status: "active",
      isCompanyFunded: true,
      principal: "100.00",
      interestRate: "5.00",
      installmentsCount: 1,
      totalDebt: "105.00",
    });
    await createInstallmentFixture({
      loanId: loan.id,
      installmentNumber: 1,
      amount: "105.00",
    });
    const voucher = await createVoucherFixture({
      loanId: loan.id,
      clientId: client!.id,
      amount: "50.00",
      operationId: `OP-APP-${Date.now()}`,
      status: "pending_admin_review",
    });

    const approved = await request
      .patch(`/api/v1/payment-vouchers/${voucher.id}/process`)
      .set(authHeader(adminToken))
      .send({ action: "approve" });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("owner_approved");

    const deleted = await request
      .delete(`/api/v1/payment-vouchers/${voucher.id}`)
      .set(authHeader(adminToken));
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.recalculation.loan.status).toBe("active");
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

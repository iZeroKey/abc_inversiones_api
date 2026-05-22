import { describe, expect, it } from "vitest";
import {
  authHeader,
  createAuditLogFixture,
  getUserByEmail,
  loginAs,
  request,
  seededEmails,
} from "../helpers/integration.js";

describe("Audit Logs Module", () => {
  it("debería permitir al admin listar logs de auditoría", async () => {
    const admin = await getUserByEmail(seededEmails.admin);
    const token = await loginAs(seededEmails.admin);

    await createAuditLogFixture({
      userId: admin!.id,
      action: "LOGIN",
      module: "AUTH",
    });

    const res = await request.get("/api/v1/audit-logs").set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("debería denegar acceso a clientes para ver logs de auditoría", async () => {
    const clientToken = await loginAs(seededEmails.client);

    const res = await request
      .get("/api/v1/audit-logs")
      .set(authHeader(clientToken));

    expect(res.status).toBe(403);
  });
});

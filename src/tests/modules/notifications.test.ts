import { describe, expect, it } from "vitest";
import { authHeader, createNotificationFixture, getUserByEmail, loginAs, request, seededEmails } from "../helpers/integration.js";

describe("Notifications Module", () => {
  it("debería obtener las notificaciones del usuario autenticado", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const token = await loginAs(seededEmails.client);

    await createNotificationFixture({
      userId: client!.id,
      title: "Test",
      body: "Test body",
      type: "SYSTEM",
    });

    const res = await request
      .get("/api/v1/notifications")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("debería marcar una notificación como leída", async () => {
    const client = await getUserByEmail(seededEmails.client);
    const token = await loginAs(seededEmails.client);
    const notification = await createNotificationFixture({
      userId: client!.id,
      title: "Unread",
    });

    const res = await request
      .patch(`/api/v1/notifications/${notification.id}/read`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });
});

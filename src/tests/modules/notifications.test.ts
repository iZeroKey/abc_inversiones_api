import { describe, expect, it } from "vitest";
import {
  authHeader,
  createAuthUser,
  createNotificationFixture,
  getUserByEmail,
  loginAs,
  request,
  seededEmails,
  uniqueEmail,
} from "../helpers/integration.js";

const createNotificationsUser = async () => {
  const user = await createAuthUser({
    email: uniqueEmail("notifications"),
    firstName: "Notif",
    lastName: "User",
    role: "client",
  });
  const token = await loginAs(user.email);

  return { user, token };
};

describe("Notifications Module", () => {
  it("debería obtener las notificaciones del usuario autenticado", async () => {
    const { user, token } = await createNotificationsUser();

    await createNotificationFixture({
      userId: user.id,
      title: "Test unread",
      body: "Test body",
      type: "SYSTEM",
    });
    await createNotificationFixture({
      userId: user.id,
      title: "Test read",
      isRead: true,
    });

    const res = await request
      .get("/api/v1/notifications")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      unreadCount: 1,
    });
  });

  it("debería filtrar notificaciones no leídas", async () => {
    const { user, token } = await createNotificationsUser();

    await createNotificationFixture({ userId: user.id, title: "Unread 1" });
    await createNotificationFixture({ userId: user.id, title: "Unread 2" });
    await createNotificationFixture({
      userId: user.id,
      title: "Read",
      isRead: true,
    });

    const res = await request
      .get("/api/v1/notifications?isRead=false&page=1&limit=10")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(
      (res.body.data as Array<{ isRead: boolean }>).every(
        (notification) => !notification.isRead,
      ),
    ).toBe(true);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      unreadCount: 2,
    });
  });

  it("debería filtrar notificaciones leídas", async () => {
    const { user, token } = await createNotificationsUser();

    await createNotificationFixture({ userId: user.id, title: "Unread" });
    await createNotificationFixture({
      userId: user.id,
      title: "Read 1",
      isRead: true,
    });
    await createNotificationFixture({
      userId: user.id,
      title: "Read 2",
      isRead: true,
    });

    const res = await request
      .get("/api/v1/notifications?isRead=true&page=1&limit=10")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(
      (res.body.data as Array<{ isRead: boolean }>).every(
        (notification) => notification.isRead,
      ),
    ).toBe(true);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      unreadCount: 1,
    });
  });

  it("debería paginar notificaciones y mantener orden createdAt DESC", async () => {
    const { user, token } = await createNotificationsUser();

    await createNotificationFixture({
      userId: user.id,
      title: "Oldest",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await createNotificationFixture({
      userId: user.id,
      title: "Middle",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    await createNotificationFixture({
      userId: user.id,
      title: "Newest",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const res = await request
      .get("/api/v1/notifications?page=2&limit=1")
      .set(authHeader(token));

    const titles = (res.body.data as Array<{ title: string }>).map(
      (notification) => notification.title,
    );

    expect(res.status).toBe(200);
    expect(titles).toEqual(["Middle"]);
    expect(res.body.meta).toMatchObject({
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3,
      unreadCount: 3,
    });
  });

  it("debería sanitizar page y limitar limit al máximo permitido", async () => {
    const { user, token } = await createNotificationsUser();

    await createNotificationFixture({
      userId: user.id,
      title: "Only notification",
    });

    const res = await request
      .get("/api/v1/notifications?page=0&limit=999")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
      unreadCount: 1,
    });
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

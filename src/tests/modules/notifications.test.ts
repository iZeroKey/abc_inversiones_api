import { describe, expect, it, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../../app.js";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock("../../config/db.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
          orderBy: vi.fn(() => []),
        })),
        orderBy: vi.fn(() => []),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => []),
        })),
      })),
    })),
  },
  queryClient: {
    end: vi.fn(),
  },
}));

import { supabase } from "../../config/supabase.js";
import { db } from "../../config/db.js";

const request = supertest(app);

describe("Notifications Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const VALID_USER_ID = "123e4567-e89b-12d3-a456-426614174000";
  const VALID_NOTIFICATION_ID = "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d6";

  it("debería obtener las notificaciones del usuario autenticado", async () => {
    const user = { id: VALID_USER_ID, role: "client", active: true };
    const mockNotifications = [
      { id: VALID_NOTIFICATION_ID, userId: VALID_USER_ID, title: "Test", body: "Test body", type: "SYSTEM", isRead: false },
    ];

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    // @ts-ignore - MOCKS: 1. Auth, 2. Get Notifications
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([user]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockNotifications),
          }),
        }),
      }),
    });

    const res = await request
      .get("/api/v1/notifications")
      .set("Authorization", "Bearer tk");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("debería marcar una notificación como leída", async () => {
    const user = { id: VALID_USER_ID, role: "client", active: true };
    const readNotification = { id: VALID_NOTIFICATION_ID, userId: VALID_USER_ID, title: "Test", isRead: true };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    // @ts-ignore - MOCK: Auth
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([user]),
        }),
      }),
    });

    // @ts-ignore
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([readNotification]),
        }),
      }),
    });

    const res = await request
      .patch(`/api/v1/notifications/${VALID_NOTIFICATION_ID}/read`)
      .set("Authorization", "Bearer tk");

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });
});

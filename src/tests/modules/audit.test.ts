import { describe, expect, it, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../../app.js";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock("../../config/db.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => []),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => []),
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

describe("Audit Logs Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ADMIN_ID = "123e4567-e89b-12d3-a456-426614174000";

  it("debería permitir al admin listar logs de auditoría", async () => {
    const admin = { id: ADMIN_ID, role: "admin", active: true, isOwner: true };
    const mockLogs = [
      { id: "log-1", userId: ADMIN_ID, action: "LOGIN", module: "AUTH", createdAt: new Date() },
    ];

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: admin }, error: null });

    // @ts-ignore - MOCKS: 1. Auth, 2. Query logs
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([admin]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockLogs),
        }),
      }),
    });

    const res = await request
      .get("/api/v1/audit-logs")
      .set("Authorization", "Bearer tk");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("debería denegar acceso a clientes para ver logs de auditoría", async () => {
    const client = { id: "client-1", role: "client", active: true };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });

    // @ts-ignore
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]),
        }),
      }),
    });

    const res = await request
      .get("/api/v1/audit-logs")
      .set("Authorization", "Bearer tk");

    expect(res.status).toBe(403);
  });
});

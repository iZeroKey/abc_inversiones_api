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
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => []),
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

describe("Loans Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const VALID_CLIENT_ID = "550e8400-e29b-41d4-a716-446655440000";
  const VALID_ADMIN_ID = "123e4567-e89b-12d3-a456-426614174000";

  it("debería permitir a un admin crear un préstamo", async () => {
    const admin = { id: VALID_ADMIN_ID, role: "admin", active: true, isOwner: true };
    const mockLoan = { id: "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d6", principal: "1000", status: "pending_admin_review" };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: admin }, error: null });
    
    // MOCKS: 1. Auth Middleware (localUser)
    // @ts-ignore
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([admin]),
        }),
      }),
    });

    // @ts-ignore
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockLoan]),
      }),
    });

    const res = await request
      .post("/api/v1/loans")
      .set("Authorization", "Bearer token")
      .send({
        clientId: VALID_CLIENT_ID,
        principal: "1000",
        interestRate: "5",
        installmentsCount: 12,
        frequency: "monthly",
        interestType: "simple",
        interestPeriod: "monthly",
      });

    expect(res.status).toBe(201);
  });
});

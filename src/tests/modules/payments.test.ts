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
    transaction: vi.fn(async (cb) => {
      const txMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };
      return await cb(txMock);
    }),
  },
  queryClient: {
    end: vi.fn(),
  },
}));

import { supabase } from "../../config/supabase.js";
import { db } from "../../config/db.js";

const request = supertest(app);

describe("Payments Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const VALID_LOAN_ID = "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d6";

  it("debería permitir registrar un pago manual", async () => {
    const admin = { id: "admin-1", role: "admin", active: true, isOwner: true };
    const mockLoan = { id: VALID_LOAN_ID, status: "active", totalDebt: "1000" };
    
    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: admin }, error: null });
    
    // 1. Auth Middleware Call
    // @ts-ignore
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([admin]),
        }),
      }),
    });

    // @ts-ignore
    db.transaction.mockImplementation(async (cb) => {
      const txMock = {
        // @ts-ignore
        select: vi.fn().mockImplementation((fields) => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([mockLoan]),
              orderBy: vi.fn().mockResolvedValue([]),
              then: (resolve: any) => resolve(fields ? [{ count: 0 }] : [mockLoan])
            })),
            orderBy: vi.fn().mockResolvedValue([])
          }))
        })),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "pay-1", amount: "100" }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      return await cb(txMock);
    });

    const res = await request
      .post("/api/v1/payments")
      .set("Authorization", "Bearer tk")
      .send({ loanId: VALID_LOAN_ID, amount: "100", method: "cash" });

    expect(res.status).toBe(201);
  });
});

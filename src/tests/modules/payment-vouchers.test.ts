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

describe("Payment Vouchers Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const VALID_LOAN_ID = "550e8400-e29b-41d4-a716-446655440000";
  const VALID_CLIENT_ID = "123e4567-e89b-12d3-a456-426614174000";
  const VALID_VOUCHER_ID = "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d6";

  it("debería permitir el flujo de doble validación de vouchers", async () => {
    const client = { id: VALID_CLIENT_ID, role: "client", active: true };
    const investor = { id: "550e8400-e29b-41d4-a716-446655440001", role: "investor", active: true };
    const mockLoan = { id: VALID_LOAN_ID, clientId: VALID_CLIENT_ID, status: "active" };
    const mockVoucher = { id: VALID_VOUCHER_ID, loanId: VALID_LOAN_ID, amount: "500", status: "pending_investor_review", operationId: "OP123" };

    // SUBIDA CLIENTE
    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });
    
    // MOCKS para SUBMIT:
    // 1. Auth Middleware (localUser)
    // 2. Duplicate Check (operationId)
    // 3. Ownership Check (loanId)
    // @ts-ignore
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]), // 1. Auth Middleware
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // 2. No duplicado
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockLoan]), // 3. Préstamo existe
        }),
      }),
    });

    // @ts-ignore
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockVoucher]),
      }),
    });

    const res1 = await request
      .post("/api/v1/payment-vouchers")
      .set("Authorization", "Bearer tk")
      .send({ loanId: VALID_LOAN_ID, amount: "500", operationId: "OP123" });

    expect(res1.status).toBe(201);

    // PROCESAMIENTO INVERSIONISTA
    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: investor }, error: null });
    
    // MOCKS para PROCESS:
    // 1. Auth Middleware (localUser)
    // 2. Get Voucher
    // @ts-ignore
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([investor]), // 1. Auth Middleware
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockVoucher]), // 2. Get Voucher
        }),
      }),
    });

    // @ts-ignore
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockVoucher, status: "investor_approved" }]),
        }),
      }),
    });

    const res2 = await request
      .patch(`/api/v1/payment-vouchers/${VALID_VOUCHER_ID}/process`)
      .set("Authorization", "Bearer tk")
      .send({ action: "approve" });

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe("investor_approved");
  });
});

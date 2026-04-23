import { describe, expect, it, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../../app.js";

const mockDocumentTextDetection = vi.fn();

vi.mock("@google-cloud/vision", () => ({
  default: {
    ImageAnnotatorClient: vi.fn(function ImageAnnotatorClient() {
      return {
      documentTextDetection: mockDocumentTextDetection,
      };
    }),
  },
}));

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
  },
  supabaseAdmin: {
    storage: {
      from: vi.fn(),
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

import { supabase, supabaseAdmin } from "../../config/supabase.js";
import { db } from "../../config/db.js";

const request = supertest(app);

describe("Payment Vouchers Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const VALID_LOAN_ID = "550e8400-e29b-41d4-a716-446655440000";
  const VALID_CLIENT_ID = "123e4567-e89b-12d3-a456-426614174000";
  const VALID_VOUCHER_ID = "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d6";
  const VALID_INVESTOR_ID = "550e8400-e29b-41d4-a716-446655440001";

  it("debería permitir al cliente subir un voucher a un préstamo activo", async () => {
    const client = { id: VALID_CLIENT_ID, role: "client", active: true };
    const mockLoan = { id: VALID_LOAN_ID, clientId: VALID_CLIENT_ID, investorId: VALID_INVESTOR_ID, status: "active" };
    const mockVoucher = { id: VALID_VOUCHER_ID, loanId: VALID_LOAN_ID, amount: "500", status: "pending_investor_review", operationId: "OP123" };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });
    
    // @ts-ignore - MOCKS: 1. Auth Middleware, 2. Duplicate Check, 3. Ownership + Active Check
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockLoan]),
        }),
      }),
    });

    // @ts-ignore
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockVoucher]),
      }),
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set("Authorization", "Bearer tk")
      .send({ loanId: VALID_LOAN_ID, amount: "500", operationId: "OP123" });

    expect(res.status).toBe(201);
  });

  it("debería analizar una imagen de voucher y devolver datos OCR normalizados", async () => {
    const client = { id: VALID_CLIENT_ID, role: "client", active: true };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });

    // @ts-ignore
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]),
        }),
      }),
    });

    mockDocumentTextDetection.mockResolvedValueOnce([
      {
        fullTextAnnotation: {
          text: "BCP Fecha: 06/04/26 Operación: OP778899 Importe: S/ 500.50",
          pages: [{ confidence: 0.94, blocks: [{ confidence: 0.91 }] }],
        },
      },
    ]);

    const res = await request
      .post("/api/v1/payment-vouchers/analyze")
      .set("Authorization", "Bearer tk")
      .attach("evidence", Buffer.from("fake-image-content"), "voucher.png");

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe("google-vision");
    expect(res.body.data.extracted.amount).toBe("500.50");
    expect(res.body.data.extracted.operationId).toBe("OP778899");
    expect(res.body.data.extracted.operationDate).toBe("2026-04-06");
    expect(res.body.data.extracted.bank).toBe("BCP");
    expect(res.body.data.meta.pages).toBe(1);
  });

  it("debería rechazar análisis OCR cuando no se adjunta imagen", async () => {
    const client = { id: VALID_CLIENT_ID, role: "client", active: true };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });

    // @ts-ignore
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]),
        }),
      }),
    });

    const res = await request
      .post("/api/v1/payment-vouchers/analyze")
      .set("Authorization", "Bearer tk");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("evidence");
  });

  it("debería devolver error si el provider OCR falla", async () => {
    const client = { id: VALID_CLIENT_ID, role: "client", active: true };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });

    // @ts-ignore
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]),
        }),
      }),
    });

    mockDocumentTextDetection.mockRejectedValueOnce(new Error("Vision unavailable"));

    const res = await request
      .post("/api/v1/payment-vouchers/analyze")
      .set("Authorization", "Bearer tk")
      .attach("evidence", Buffer.from("fake-image-content"), "voucher.png");

    expect(res.status).toBe(500);
    expect(res.body.message).toContain("Vision unavailable");
  });

  it("debería permitir al cliente subir un voucher adjuntando una imagen como evidencia", async () => {
    const client = { id: VALID_CLIENT_ID, role: "client", active: true };
    const mockLoan = { id: VALID_LOAN_ID, clientId: VALID_CLIENT_ID, investorId: VALID_INVESTOR_ID, status: "active" };
    const mockVoucher = { id: VALID_VOUCHER_ID, loanId: VALID_LOAN_ID, amount: "500", status: "pending_investor_review", operationId: "OP124", evidenceUrl: "https://fake.url" };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });
    
    // @ts-ignore - MOCKS: 1. Auth Middleware, 2. Duplicate Check, 3. Ownership + Active Check
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockLoan]),
        }),
      }),
    });

    // @ts-ignore
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockVoucher]),
      }),
    });

    const mockUpload = vi.fn().mockResolvedValue({ data: { path: "fake/path.jpg" }, error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://fake.supabase.co/storage/v1/object/public/vouchers/fake/path.jpg" } });
    
    // @ts-ignore
    supabaseAdmin.storage.from.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set("Authorization", "Bearer tk")
      .field("loanId", VALID_LOAN_ID)
      .field("amount", "500")
      .field("operationId", "OP124")
      .attach("evidence", Buffer.from("fake-image-content"), "voucher.png");

    expect(res.status).toBe(201);
    
    // Verificar que se haya llamado a la subida de Supabase Storage con false en upsert
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining(`${VALID_LOAN_ID}/`),
      expect.any(Buffer),
      expect.objectContaining({ upsert: false, contentType: "image/png" })
    );
  });

  it("debería rechazar un voucher si el préstamo no está activo", async () => {
    const client = { id: VALID_CLIENT_ID, role: "client", active: true };
    const mockLoan = { id: VALID_LOAN_ID, clientId: VALID_CLIENT_ID, status: "pending_admin_review" };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: client }, error: null });
    
    // @ts-ignore - MOCKS: 1. Auth, 2. Duplicate, 3. Loan (not active)
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([client]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockLoan]),
        }),
      }),
    });

    const res = await request
      .post("/api/v1/payment-vouchers")
      .set("Authorization", "Bearer tk")
      .send({ loanId: VALID_LOAN_ID, amount: "500", operationId: "OP456" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("activos");
  });

  it("debería permitir aprobación del inversionista", async () => {
    const investor = { id: VALID_INVESTOR_ID, role: "investor", active: true };
    const mockVoucher = { id: VALID_VOUCHER_ID, loanId: VALID_LOAN_ID, clientId: VALID_CLIENT_ID, amount: "500", status: "pending_investor_review", operationId: "OP123" };
    const mockLoan = { id: VALID_LOAN_ID, investorId: VALID_INVESTOR_ID };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: investor }, error: null });
    
    // @ts-ignore - MOCKS: 1. Auth, 2. Get Voucher, 3. Get Loan
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([investor]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockVoucher]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockLoan]),
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

    const res = await request
      .patch(`/api/v1/payment-vouchers/${VALID_VOUCHER_ID}/process`)
      .set("Authorization", "Bearer tk")
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("investor_approved");
  });

  it("debería impedir al admin aprobar sin aprobación previa del inversionista", async () => {
    const admin = { id: "adm-00000-0000-0000-000000000001", role: "admin", active: true, isOwner: true };
    const mockVoucher = { id: VALID_VOUCHER_ID, loanId: VALID_LOAN_ID, clientId: VALID_CLIENT_ID, amount: "500", status: "pending_investor_review", operationId: "OP123" };
    const mockLoan = { id: VALID_LOAN_ID, investorId: VALID_INVESTOR_ID };

    // @ts-ignore
    supabase.auth.getUser.mockResolvedValue({ data: { user: admin }, error: null });
    
    // @ts-ignore - MOCKS: 1. Auth, 2. Get Voucher, 3. Get Loan (has investor)
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([admin]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockVoucher]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockLoan]),
        }),
      }),
    });

    const res = await request
      .patch(`/api/v1/payment-vouchers/${VALID_VOUCHER_ID}/process`)
      .set("Authorization", "Bearer tk")
      .send({ action: "approve" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("inversionista debe aprobar");
  });
});

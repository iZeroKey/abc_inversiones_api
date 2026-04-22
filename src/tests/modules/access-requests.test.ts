import { describe, expect, it, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../../app.js";
import { supabase, supabaseAdmin } from "../../config/supabase.js";
import { db } from "../../config/db.js";
import { accessRequests } from "../../db/schema/access-requests.js";
import { users } from "../../db/schema/users.js";
import { eq } from "drizzle-orm";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: vi.fn(),
      },
    },
  },
}));

const request = supertest(app);

describe("Access Requests Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getAdmin = async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@abc.com")).limit(1);
    return admin;
  };

  describe("POST /api/v1/access-requests (Público)", () => {
    it("debería permitir a un postulante enviar una solicitud", async () => {
      const payload = {
        email: "postulante@example.com",
        firstName: "Juan",
        lastName: "Pérez",
        phone: "+51900000000",
        roleRequested: "client",
      };

      const res = await request.post("/api/v1/access-requests").send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe(payload.email);
      expect(res.body.data.status).toBe("pending");
    });
  });

  describe("Flujo de Aprobación (Admin)", () => {
    it("debería crear un usuario automáticamente al aprobar una solicitud", async () => {
      // 1. Crear una solicitud previa
      const [newReq] = await db.insert(accessRequests).values({
        email: "aprobado@example.com",
        firstName: "Maria",
        lastName: "Garcia",
        phone: "+51911111111",
        roleRequested: "investor",
      }).returning();

      const admin = await getAdmin();

      // 2. Mockear Auth para el middleware y para la creación del usuario
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: admin.id } },
        error: null,
      });
      // @ts-ignore
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: "new-auth-id" } },
        error: null,
      });

      // 3. Aprobar la solicitud
      const res = await request
        .patch(`/api/v1/access-requests/${newReq.id}/status`)
        .set("Authorization", "Bearer admin-token")
        .send({ status: "approved", observation: "Todo correcto" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");

      // 4. Verificar que el usuario existe en la tabla local
      const [createdUser] = await db.select().from(users).where(eq(users.email, "aprobado@example.com")).limit(1);
      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBe("new-auth-id");
      expect(createdUser.role).toBe("investor");
    });
  });
});

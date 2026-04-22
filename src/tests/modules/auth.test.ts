import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
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

vi.mock("../../config/db.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    insert: vi.fn(),
  },
  queryClient: {
    end: vi.fn(),
  },
}));

import { db } from "../../config/db.js";
import { supabase, supabaseAdmin } from "../../config/supabase.js";

const request = supertest(app);

describe("Auth Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/login", () => {
    it("debería retornar 400 si los datos son inválidos", async () => {
      const res = await request.post("/api/v1/auth/login").send({
        email: "invalido",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Datos inválidos");
    });

    it("debería retornar 401 si las credenciales son incorrectas", async () => {
      // @ts-ignore
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      });

      const res = await request.post("/api/v1/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Credenciales incorrectas");
    });

    it("debería autenticar correctamente", async () => {
      const mockUser = {
        id: "uuid-local",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "client",
      };

      // @ts-ignore
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: "uuid-supabase", email: "test@example.com" },
          session: { access_token: "token-123" },
        },
        error: null,
      });

      // @ts-ignore
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const res = await request.post("/api/v1/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("test@example.com");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("debería cerrar sesión correctamente", async () => {
      // Mock de autenticación exitosa para el middleware
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-id" } },
        error: null,
      });
      // @ts-ignore
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "user-id", active: true }]),
          }),
        }),
      });

      // @ts-ignore
      supabase.auth.signOut.mockResolvedValue({ error: null });

      const res = await request
        .post("/api/v1/auth/logout")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Sesión cerrada correctamente");
    });
  });

  describe("POST /api/v1/auth/register", () => {
    it("debería permitir al admin registrar un nuevo usuario", async () => {
      const adminUser = { id: "admin-id", role: "admin", active: true };

      // Simular autenticación de Admin para el middleware
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: adminUser.id } },
        error: null,
      });
      // @ts-ignore
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([adminUser]),
          }),
        }),
      });

      const newUserPayload = {
        email: "nuevo@abc.com",
        password: "password123",
        firstName: "Nuevo",
        lastName: "Usuario",
        role: "client",
        isOwner: false,
      };

      // @ts-ignore
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: "new-uuid-supabase" } },
        error: null,
      });

      // @ts-ignore
      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "new-uuid-local",
              ...newUserPayload,
            },
          ]),
        }),
      });

      const res = await request
        .post("/api/v1/auth/register")
        .set("Authorization", "Bearer admin-token")
        .send(newUserPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("nuevo@abc.com");
    });

    it("debería retornar error si Supabase falla", async () => {
      const adminUser = { id: "admin-id", role: "admin", active: true };

      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: adminUser.id } },
        error: null,
      });
      // @ts-ignore
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([adminUser]),
          }),
        }),
      });

      // @ts-ignore
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Email already exists" },
      });

      const res = await request
        .post("/api/v1/auth/register")
        .set("Authorization", "Bearer admin-token")
        .send({
          email: "existe@abc.com",
          password: "password123",
          firstName: "Existe",
          lastName: "Usuario",
          role: "client",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Error en Supabase Auth");
    });
  });
});

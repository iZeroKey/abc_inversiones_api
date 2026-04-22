import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
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
      const res = await request
        .post("/api/v1/auth/login")
        .send({ email: "invalido" });
      expect(res.status).toBe(400);
    });

    it("debería retornar 401 si las credenciales son incorrectas", async () => {
      // @ts-ignore
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      });
      const res = await request
        .post("/api/v1/auth/login")
        .send({ email: "test@abc.com", password: "password123" });
      expect(res.status).toBe(401);
    });

    it("debería autenticar correctamente", async () => {
      const mockUser = {
        id: "uid",
        email: "test@abc.com",
        role: "client",
        firstName: "Test",
        lastName: "User",
      };
      // @ts-ignore
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: "uid" }, session: { access_token: "tk" } },
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
      const res = await request
        .post("/api/v1/auth/login")
        .send({ email: "test@abc.com", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe("test@abc.com");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("debería cerrar sesión correctamente", async () => {
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "id" } },
        error: null,
      });
      // @ts-ignore
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "id", active: true }]),
          }),
        }),
      });
      // @ts-ignore
      supabase.auth.signOut.mockResolvedValue({ error: null });

      const res = await request
        .post("/api/v1/auth/logout")
        .set("Authorization", "Bearer tk");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/v1/auth/change-password", () => {
    it("debería cambiar la contraseña si la actual es correcta", async () => {
      const mockUser = { id: "id", email: "test@abc.com", active: true };
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
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
      // @ts-ignore
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: null,
      });
      // @ts-ignore
      supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });

      const res = await request
        .post("/api/v1/auth/change-password")
        .set("Authorization", "Bearer tk")
        .send({
          currentPassword: "old-password",
          newPassword: "new-password123",
        });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/v1/auth/register", () => {
    it("debería permitir al admin registrar un nuevo usuario", async () => {
      const admin = { id: "adm", role: "admin", active: true };
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: admin },
        error: null,
      });
      // @ts-ignore
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockReturnValue({ limit: vi.fn().mockResolvedValue([admin]) }),
        }),
      });
      // @ts-ignore
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: "new" } },
        error: null,
      });
      // @ts-ignore
      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "new", email: "new@abc.com" }]),
        }),
      });

      const res = await request
        .post("/api/v1/auth/register")
        .set("Authorization", "Bearer tk")
        .send({
          email: "new@abc.com",
          password: "password123",
          firstName: "Nuevo",
          lastName: "Usuario",
          role: "client",
        });
      expect(res.status).toBe(201);
    });
  });
});

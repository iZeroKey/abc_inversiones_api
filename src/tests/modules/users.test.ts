import { eq } from "drizzle-orm";
import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { db } from "../../config/db.js";
import { supabase, supabaseAdmin } from "../../config/supabase.js";
import { users } from "../../db/schema/users.js";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
  supabaseAdmin: {
    auth: {
      admin: {
        listUsers: vi
          .fn()
          .mockResolvedValue({ data: { users: [] }, error: null }),
        deleteUser: vi.fn(),
        createUser: vi.fn(),
      },
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

const request = supertest(app);

describe("Users Module Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getTestUser = async (email: string) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  };

  describe("GET /api/v1/users/me", () => {
    it("debería retornar el perfil del usuario autenticado", async () => {
      const admin = await getTestUser("admin@abc.com");

      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: admin.id, email: admin.email } },
        error: null,
      });

      const res = await request
        .get("/api/v1/users/me")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(admin.email);
      expect(res.body.data.role).toBe("admin");
    });
  });

  describe("GET /api/v1/users (Admin Access)", () => {
    it("debería permitir al admin listar usuarios", async () => {
      const admin = await getTestUser("admin@abc.com");
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: admin.id, email: admin.email } },
        error: null,
      });

      const res = await request
        .get("/api/v1/users")
        .set("Authorization", "Bearer token-admin");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("debería denegar acceso a un cliente para listar usuarios", async () => {
      const client = await getTestUser("client@abc.com");
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: client.id, email: client.email } },
        error: null,
      });

      const res = await request
        .get("/api/v1/users")
        .set("Authorization", "Bearer token-client");

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "No tienes permisos para realizar esta acción",
      );
    });
  });

  describe("PATCH /api/v1/users/:id", () => {
    it("debería permitir a un usuario actualizar su propio nombre", async () => {
      const client = await getTestUser("client@abc.com");
      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: client.id, email: client.email } },
        error: null,
      });

      const res = await request
        .patch(`/api/v1/users/${client.id}`)
        .set("Authorization", "Bearer token-client")
        .send({ firstName: "NuevoNombre" });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe("NuevoNombre");
    });

    it("debería denegar a un cliente actualizar a otro usuario", async () => {
      const client = await getTestUser("client@abc.com");
      const admin = await getTestUser("admin@abc.com");

      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: client.id, email: client.email } },
        error: null,
      });

      const res = await request
        .patch(`/api/v1/users/${admin.id}`)
        .set("Authorization", "Bearer token-client")
        .send({ firstName: "Hack" });

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/v1/users/me/avatar", () => {
    it("debería permitir actualizar la foto de perfil subiendo una imagen (upsert)", async () => {
      const client = await getTestUser("client@abc.com");

      // @ts-ignore
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: client.id, email: client.email } },
        error: null,
      });

      // Mapear el mock the storage
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: "fake/path.jpg" }, error: null });
      const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://fake.supabase.co/storage/v1/object/public/avatars/fake/path.jpg" } });
      
      // @ts-ignore
      supabaseAdmin.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const res = await request
        .patch("/api/v1/users/me/avatar")
        .set("Authorization", "Bearer token-client")
        .attach("avatar", Buffer.from("fake-image-content"), "profile.png");

      expect(res.status).toBe(200);
      expect(res.body.data.avatarUrl).toBe("https://fake.supabase.co/storage/v1/object/public/avatars/fake/path.jpg");

      // Validar que se llamó al upsert de Supabase Storage
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining(`${client.id}/avatar.png`),
        expect.any(Buffer),
        expect.objectContaining({ upsert: true, contentType: "image/png" })
      );
    });
  });
});

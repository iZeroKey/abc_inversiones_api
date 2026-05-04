import { describe, expect, it } from "vitest";
import { authHeader, getUserByEmail, loginAs, request, seededEmails } from "../helpers/integration.js";

describe("Users Module Integration", () => {
  describe("GET /api/v1/users/me", () => {
    it("debería retornar el perfil del usuario autenticado", async () => {
      const res = await request
        .get("/api/v1/users/me")
        .set(authHeader(await loginAs(seededEmails.admin)));

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(seededEmails.admin);
      expect(res.body.data.role).toBe("admin");
    });
  });

  describe("GET /api/v1/users", () => {
    it("debería permitir al admin listar usuarios", async () => {
      const res = await request
        .get("/api/v1/users")
        .set(authHeader(await loginAs(seededEmails.admin)));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("debería denegar acceso a un cliente para listar usuarios", async () => {
      const res = await request
        .get("/api/v1/users")
        .set(authHeader(await loginAs(seededEmails.client)));

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("No tienes permisos para realizar esta acción");
    });
  });

  describe("PATCH /api/v1/users/:id", () => {
    it("debería permitir a un usuario actualizar su propio nombre", async () => {
      const client = await getUserByEmail(seededEmails.client);
      const res = await request
        .patch(`/api/v1/users/${client!.id}`)
        .set(authHeader(await loginAs(seededEmails.client)))
        .send({ firstName: "NuevoNombre" });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe("NuevoNombre");
    });

    it("debería denegar a un cliente actualizar a otro usuario", async () => {
      const client = await getUserByEmail(seededEmails.client);
      const admin = await getUserByEmail(seededEmails.admin);

      const res = await request
        .patch(`/api/v1/users/${admin!.id}`)
        .set(authHeader(await loginAs(seededEmails.client)))
        .send({ firstName: "Hack" });

      expect(res.status).toBe(403);
      expect(client).toBeDefined();
    });
  });

  describe("PATCH /api/v1/users/me/avatar", () => {
    it("debería permitir actualizar la foto de perfil subiendo una imagen real", async () => {
      const res = await request
        .patch("/api/v1/users/me/avatar")
        .set(authHeader(await loginAs(seededEmails.client)))
        .attach("avatar", Buffer.from("fake-image-content"), "profile.png");

      expect(res.status).toBe(200);
      expect(res.body.data.avatarUrl).toContain("token=");
    });
  });

  describe("DELETE /api/v1/users/me/avatar", () => {
    it("debería permitir eliminar la foto de perfil del usuario autenticado", async () => {
      const token = await loginAs(seededEmails.client);

      const uploadRes = await request
        .patch("/api/v1/users/me/avatar")
        .set(authHeader(token))
        .attach("avatar", Buffer.from("fake-image-content"), "profile.png");

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.data.avatarUrl).toContain("token=");

      const deleteRes = await request
        .delete("/api/v1/users/me/avatar")
        .set(authHeader(token));

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.avatarUrl).toBeNull();

      const user = await getUserByEmail(seededEmails.client);
      expect(user!.avatarUrl).toBeNull();
    });
  });
});

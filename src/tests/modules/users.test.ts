import { describe, expect, it } from "vitest";
import { generatePublicCode } from "../../utils/public-code.util.js";
import {
  authHeader,
  createAuthUser,
  getUserByEmail,
  loginAs,
  request,
  seededEmails,
  uniqueEmail,
} from "../helpers/integration.js";

describe("Users Module Integration", () => {
  describe("GET /api/v1/users/me", () => {
    it("debería retornar el perfil del usuario autenticado", async () => {
      const res = await request
        .get("/api/v1/users/me")
        .set(authHeader(await loginAs(seededEmails.admin)));

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(seededEmails.admin);
      expect(res.body.data.role).toBe("admin");
      expect(res.body.data.publicCode).toBe("AD-00001");
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

      const client = res.body.data.find(
        (user: { email: string }) => user.email === seededEmails.client,
      );
      const investor = res.body.data.find(
        (user: { email: string }) => user.email === seededEmails.investor,
      );
      const admin = res.body.data.find(
        (user: { email: string }) => user.email === seededEmails.admin,
      );
      expect(admin.publicCode).toBe("AD-00001");
      expect(client.publicCode).toBe("CL-00001");
      expect(investor.publicCode).toBe("IN-00001");
    });

    it("debería generar códigos únicos sin duplicación", async () => {
      const publicCodes = [];
      for (let i = 0; i < 4; i++) {
        publicCodes.push(await generatePublicCode("client"));
      }

      expect(new Set(publicCodes).size).toBe(publicCodes.length);
      expect(publicCodes.every((code) => /^CL-\d{5}$/.test(code || ""))).toBe(
        true,
      );
    });

    it("debería denegar acceso a un cliente para listar usuarios", async () => {
      const res = await request
        .get("/api/v1/users")
        .set(authHeader(await loginAs(seededEmails.client)));

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "No tienes permisos para realizar esta acción",
      );
    });
  });

  describe("POST /api/v1/users", () => {
    it("debería permitir al admin crear un cliente operativo sin cuenta Auth", async () => {
      const res = await request
        .post("/api/v1/users")
        .set(authHeader(await loginAs(seededEmails.admin)))
        .send({
          firstName: "Cliente",
          lastName: "SinCuenta",
          role: "client",
          dni: "12345678",
          address: "Av. Prueba 123",
          bank: "BCP",
          bankAccounts: ["191-00000000-0-00", "00219100000000000000"],
          maritalStatus: "single",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.authUserId).toBeNull();
      expect(res.body.data.email).toBeNull();
      expect(res.body.data.publicCode).toMatch(/^CL-\d{5}$/);
      expect(res.body.data.bankAccounts).toEqual([
        "191-00000000-0-00",
        "00219100000000000000",
      ]);
      expect(res.body.data.maritalStatus).toBe("single");
    });
  });

  describe("PATCH /api/v1/users/:id", () => {
    it("debería permitir a un usuario actualizar sus datos de perfil seguros", async () => {
      const client = await createAuthUser({
        email: uniqueEmail("user-self-update"),
        firstName: "Perfil",
        lastName: "Seguro",
        role: "client",
      });

      const res = await request
        .patch(`/api/v1/users/${client.id}`)
        .set(authHeader(await loginAs(client.email)))
        .send({
          firstName: "NuevoNombre",
          lastName: "Actualizado",
          phone: "999888777",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe("NuevoNombre");
      expect(res.body.data.lastName).toBe("Actualizado");
      expect(res.body.data.phone).toBe("999888777");
    });

    it("debería impedir que un cliente cambie su propio rol", async () => {
      const client = await createAuthUser({
        email: uniqueEmail("user-role-block"),
        firstName: "Rol",
        lastName: "Bloqueado",
        role: "client",
      });

      const res = await request
        .patch(`/api/v1/users/${client.id}`)
        .set(authHeader(await loginAs(client.email)))
        .send({ role: "admin" });

      expect(res.status).toBe(400);

      const updated = await getUserByEmail(client.email);
      expect(updated?.role).toBe("client");
    });

    it("debería impedir que un cliente cambie su propio estado active", async () => {
      const client = await createAuthUser({
        email: uniqueEmail("user-active-block"),
        firstName: "Activo",
        lastName: "Bloqueado",
        role: "client",
      });

      const res = await request
        .patch(`/api/v1/users/${client.id}`)
        .set(authHeader(await loginAs(client.email)))
        .send({ active: false });

      expect(res.status).toBe(400);

      const updated = await getUserByEmail(client.email);
      expect(updated?.active).toBe(true);
    });

    it("debería permitir al admin cambiar datos administrativos permitidos de un no admin", async () => {
      const manager = await createAuthUser({
        email: uniqueEmail("manager-user-update"),
        firstName: "Admin",
        lastName: "Operador",
        role: "admin",
      });
      const client = await createAuthUser({
        email: uniqueEmail("admin-user-update"),
        firstName: "Admin",
        lastName: "Target",
        role: "client",
      });

      const res = await request
        .patch(`/api/v1/users/${client.id}`)
        .set(authHeader(await loginAs(manager.email)))
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe("client");
      expect(res.body.data.active).toBe(false);
      expect(res.body.data.publicCode).toBe(client.publicCode);
    });

    it("debería impedir que el owner cambie el rol de un usuario", async () => {
      const client = await createAuthUser({
        email: uniqueEmail("owner-role-block"),
        firstName: "Rol",
        lastName: "Fijo",
        role: "client",
      });

      const res = await request
        .patch(`/api/v1/users/${client.id}`)
        .set(authHeader(await loginAs(seededEmails.admin)))
        .send({ role: "investor" });

      expect(res.status).toBe(400);
      const updated = await getUserByEmail(client.email);
      expect(updated?.role).toBe("client");
      expect(updated?.publicCode).toBe(client.publicCode);
    });

    it("debería impedir que el owner cambie isOwner por API", async () => {
      const targetAdmin = await createAuthUser({
        email: uniqueEmail("owner-flag-block"),
        firstName: "Owner",
        lastName: "Flag",
        role: "admin",
      });

      const res = await request
        .patch(`/api/v1/users/${targetAdmin.id}`)
        .set(authHeader(await loginAs(seededEmails.admin)))
        .send({ isOwner: true });

      expect(res.status).toBe(400);
      const updated = await getUserByEmail(targetAdmin.email);
      expect(updated?.isOwner).toBe(false);
    });

    it("debería impedir que un admin gestione a otro admin", async () => {
      const manager = await createAuthUser({
        email: uniqueEmail("manager-block"),
        firstName: "Admin",
        lastName: "Uno",
        role: "admin",
      });
      const targetAdmin = await createAuthUser({
        email: uniqueEmail("manager-target"),
        firstName: "Admin",
        lastName: "Dos",
        role: "admin",
      });

      const res = await request
        .patch(`/api/v1/users/${targetAdmin.id}`)
        .set(authHeader(await loginAs(manager.email)))
        .send({ firstName: "NoPermitido" });

      expect(res.status).toBe(403);
      const updated = await getUserByEmail(targetAdmin.email);
      expect(updated?.firstName).toBe("Admin");
    });

    it("debería permitir al owner gestionar a otro admin", async () => {
      const targetAdmin = await createAuthUser({
        email: uniqueEmail("owner-admin-target"),
        firstName: "Admin",
        lastName: "Gestionable",
        role: "admin",
      });

      const res = await request
        .patch(`/api/v1/users/${targetAdmin.id}`)
        .set(authHeader(await loginAs(seededEmails.admin)))
        .send({ firstName: "Actualizado", active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe("Actualizado");
      expect(res.body.data.active).toBe(false);
      expect(res.body.data.publicCode).toMatch(/^AD-\d{5}$/);
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
      expect(res.body.data.avatarUrl).toContain("storage://");
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
      expect(uploadRes.body.data.avatarUrl).toContain("storage://");

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

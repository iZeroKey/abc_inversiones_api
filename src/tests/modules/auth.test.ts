import { describe, expect, it } from "vitest";
import {
  authHeader,
  createAuthUser,
  getUserByEmail,
  loginAs,
  request,
  seededEmails,
  TEST_PASSWORD,
  uniqueEmail,
} from "../helpers/integration.js";

describe("Auth Endpoints", () => {
  describe("POST /api/v1/auth/login", () => {
    it("debería retornar 400 si los datos son inválidos", async () => {
      const res = await request
        .post("/api/v1/auth/login")
        .send({ email: "invalido" });

      expect(res.status).toBe(400);
    });

    it("debería retornar 401 si las credenciales son incorrectas", async () => {
      const res = await request
        .post("/api/v1/auth/login")
        .send({ email: seededEmails.admin, password: "bad-password" });

      expect(res.status).toBe(401);
    });

    it("debería autenticar correctamente a un usuario sembrado", async () => {
      const res = await request
        .post("/api/v1/auth/login")
        .send({ email: seededEmails.admin, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(seededEmails.admin);
      expect(res.body.data.session.access_token).toBeTruthy();
      expect(res.body.data.session.refresh_token).toBeTruthy();
      expect(typeof res.body.data.session.expires_in).toBe("number");
      expect(res.body.data.session.user).toBeUndefined();
      expect(res.body.data.session.token_type).toBeUndefined();
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("debería cerrar sesión correctamente", async () => {
      const token = await loginAs(seededEmails.admin);

      const res = await request
        .post("/api/v1/auth/logout")
        .set(authHeader(token));

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/v1/auth/register", () => {
    it("debería permitir al admin registrar un nuevo usuario", async () => {
      const adminToken = await loginAs(seededEmails.admin);
      const email = uniqueEmail("register");

      const res = await request
        .post("/api/v1/auth/register")
        .set(authHeader(adminToken))
        .send({
          email,
          password: TEST_PASSWORD,
          firstName: "Nuevo",
          lastName: "Usuario",
          role: "client",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe(email);

      const created = await getUserByEmail(email);
      expect(created).toBeDefined();
      expect(created?.role).toBe("client");
    });
  });

  describe("POST /api/v1/auth/change-password", () => {
    it("debería cambiar la contraseña y permitir login con la nueva", async () => {
      const tempUser = await createAuthUser({
        email: uniqueEmail("changepw"),
        firstName: "Cambio",
        lastName: "Clave",
        role: "client",
      });

      const token = await loginAs(tempUser.email);
      const newPassword = "new-password123";

      const res = await request
        .post("/api/v1/auth/change-password")
        .set(authHeader(token))
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword,
        });

      expect(res.status).toBe(200);

      const relogin = await request
        .post("/api/v1/auth/login")
        .send({ email: tempUser.email, password: newPassword });

      expect(relogin.status).toBe(200);
    });
  });
});

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
        .send({ email: "inválido" });

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

  describe("POST /api/v1/auth/refresh", () => {
    it("debería retornar 400 si el refresh_token es inválido", async () => {
      const res = await request.post("/api/v1/auth/refresh").send({});

      expect(res.status).toBe(400);
    });

    it("debería refrescar la sesión con un refresh_token válido", async () => {
      const login = await request
        .post("/api/v1/auth/login")
        .send({ email: seededEmails.client, password: TEST_PASSWORD });

      const res = await request.post("/api/v1/auth/refresh").send({
        refresh_token: login.body.data.session.refresh_token,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.session.access_token).toBeTruthy();
      expect(res.body.data.session.refresh_token).toBeTruthy();
      expect(typeof res.body.data.session.expires_in).toBe("number");
      expect(res.body.data.session.user).toBeUndefined();
      expect(res.body.data.session.token_type).toBeUndefined();
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
      expect(res.body.data.user.publicCode).toMatch(/^CL-\d{5}$/);

      const created = await getUserByEmail(email);
      expect(created).toBeDefined();
      expect(created?.role).toBe("client");
      expect(created?.publicCode).toMatch(/^CL-\d{5}$/);
    });

    it("debería permitir al owner registrar un administrador con código público", async () => {
      const ownerToken = await loginAs(seededEmails.admin);
      const email = uniqueEmail("register-admin");

      const res = await request
        .post("/api/v1/auth/register")
        .set(authHeader(ownerToken))
        .send({
          email,
          password: TEST_PASSWORD,
          firstName: "Nuevo",
          lastName: "Admin",
          role: "admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.role).toBe("admin");
      expect(res.body.data.user.isOwner).toBe(false);
      expect(res.body.data.user.publicCode).toMatch(/^AD-\d{5}$/);
    });

    it("debería impedir asignar isOwner al registrar por API", async () => {
      const ownerToken = await loginAs(seededEmails.admin);
      const email = uniqueEmail("register-owner-block");

      const res = await request
        .post("/api/v1/auth/register")
        .set(authHeader(ownerToken))
        .send({
          email,
          password: TEST_PASSWORD,
          firstName: "Owner",
          lastName: "Bloqueado",
          role: "admin",
          isOwner: true,
        });

      expect(res.status).toBe(400);

      const created = await getUserByEmail(email);
      expect(created).toBeUndefined();
    });

    it("debería impedir que un admin no owner registre administradores", async () => {
      const manager = await createAuthUser({
        email: uniqueEmail("register-manager"),
        firstName: "Admin",
        lastName: "NoOwner",
        role: "admin",
      });

      const res = await request
        .post("/api/v1/auth/register")
        .set(authHeader(await loginAs(manager.email)))
        .send({
          email: uniqueEmail("forbidden-admin"),
          password: TEST_PASSWORD,
          firstName: "Admin",
          lastName: "Bloqueado",
          role: "admin",
        });

      expect(res.status).toBe(403);
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

      const oldPasswordLogin = await request
        .post("/api/v1/auth/login")
        .send({ email: tempUser.email, password: TEST_PASSWORD });

      expect(oldPasswordLogin.status).toBe(401);
    });

    it("debería rechazar el cambio si la contraseña actual es incorrecta", async () => {
      const tempUser = await createAuthUser({
        email: uniqueEmail("changepw-bad"),
        firstName: "Cambio",
        lastName: "Fallido",
        role: "client",
      });

      const token = await loginAs(tempUser.email);

      const res = await request
        .post("/api/v1/auth/change-password")
        .set(authHeader(token))
        .send({
          currentPassword: "wrong-password",
          newPassword: "new-password123",
        });

      expect(res.status).toBe(401);
    });
  });
});

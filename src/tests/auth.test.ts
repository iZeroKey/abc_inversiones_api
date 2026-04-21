import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("Auth endpoints - phase 1 baseline", () => {
  it("returns 400 when login payload is invalid", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "not-an-email",
      password: "123",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it("returns 501 for valid login payload while auth is not implemented", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "cliente@abc.com",
      password: "abc12345",
    });

    expect(response.status).toBe(501);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTH_NOT_IMPLEMENTED");
  });

  it("returns 200 for auth me baseline endpoint", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toBeNull();
  });
});

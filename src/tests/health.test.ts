import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("GET /api/v1/health", () => {
  it("returns health payload with standard success contract", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Operacion exitosa");
    expect(response.body.data).toEqual({
      status: "ok",
      service: "abc-inversiones-api",
    });
    expect(response.body.meta).toEqual({
      requestId: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
  });
});

import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";

const request = supertest(app);

describe("Health Endpoints", () => {
  it("GET /api/v1/health debería retornar 200", async () => {
    const res = await request.get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.meta).toHaveProperty("timestamp");
  });
});

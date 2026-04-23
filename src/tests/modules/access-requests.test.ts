import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../config/db.js";
import { accessRequests } from "../../db/schema/access-requests.js";
import { users } from "../../db/schema/users.js";
import { authHeader, createAccessRequestFixture, loginAs, request, seededEmails, uniqueEmail } from "../helpers/integration.js";

describe("Access Requests Module", () => {
  describe("POST /api/v1/access-requests", () => {
    it("debería permitir a un postulante enviar una solicitud", async () => {
      const payload = {
        email: uniqueEmail("postulante"),
        firstName: "Juan",
        lastName: "Perez",
        phone: "+51900000000",
        roleRequested: "client",
      };

      const res = await request.post("/api/v1/access-requests").send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe(payload.email);
      expect(res.body.data.status).toBe("pending");
    });
  });

  describe("PATCH /api/v1/access-requests/:id/status", () => {
    it("debería crear un usuario automáticamente al aprobar una solicitud", async () => {
      const email = uniqueEmail("approved");
      const accessRequest = await createAccessRequestFixture({
        email,
        firstName: "Maria",
        lastName: "Garcia",
        phone: "+51911111111",
        roleRequested: "investor",
      });

      const adminToken = await loginAs(seededEmails.admin);

      const res = await request
        .patch(`/api/v1/access-requests/${accessRequest.id}/status`)
        .set(authHeader(adminToken))
        .send({
          status: "approved",
          observation: "Todo correcto",
          initialPassword: "investor123",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");

      const [createdUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      expect(createdUser).toBeDefined();
      expect(createdUser?.role).toBe("investor");

      const [updatedRequest] = await db.select().from(accessRequests).where(eq(accessRequests.id, accessRequest.id)).limit(1);
      expect(updatedRequest?.status).toBe("approved");
    });
  });
});

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../config/db.js";
import { users } from "../../db/schema/users.js";

describe("Database Integration", () => {
  it("debería encontrar al usuario administrador sembrado en la base de datos", async () => {
    const adminEmail = "admin@abc.com";

    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    expect(admin).toBeDefined();
    expect(admin.email).toBe(adminEmail);
    expect(admin.role).toBe("admin");
    expect(admin.isOwner).toBe(true);
  });
});

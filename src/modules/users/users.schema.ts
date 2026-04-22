import { z } from "zod";

export const updateUserSchema = z.object({
  firstName: z.string().min(2, "El nombre es muy corto").optional(),
  lastName: z.string().min(2, "El apellido es muy corto").optional(),
  role: z.enum(["client", "investor", "owner", "admin"]).optional(),
  active: z.boolean().optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

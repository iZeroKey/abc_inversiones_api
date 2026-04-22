import { z } from "zod";

export const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(["client", "investor", "admin"]).optional(),
  active: z.boolean().optional(),
});

export const updateAvatarSchema = z.object({
  avatarUrl: z.url("La URL del avatar debe ser válida"),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UpdateAvatarDto = z.infer<typeof updateAvatarSchema>;

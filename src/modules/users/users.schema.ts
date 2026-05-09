import { z } from "zod";

export const selfUpdateUserSchema = z.strictObject({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
});

export const adminUpdateUserSchema = selfUpdateUserSchema.extend({
  active: z.boolean().optional(),
  isOwner: z.boolean().optional(),
});

export const updateAvatarSchema = z.object({
  avatarUrl: z.url("La URL del avatar debe ser válida"),
});

export type SelfUpdateUserDto = z.infer<typeof selfUpdateUserSchema>;
export type AdminUpdateUserDto = z.infer<typeof adminUpdateUserSchema>;
export type UpdateAvatarDto = z.infer<typeof updateAvatarSchema>;

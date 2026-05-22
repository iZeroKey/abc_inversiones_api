import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1, "El refresh_token es obligatorio"),
});

export const registerSchema = z.strictObject({
  email: z.email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  firstName: z.string().min(2, "El nombre es muy corto"),
  lastName: z.string().min(2, "El apellido es muy corto"),
  phone: z.string().optional(),
  role: z.enum(["client", "investor", "admin"]).default("client"),
  dni: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  bankAccounts: z.array(z.string().min(1)).optional().default([]),
  maritalStatus: z
    .enum(["single", "married", "unspecified"])
    .optional()
    .nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria"),
  newPassword: z
    .string()
    .min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

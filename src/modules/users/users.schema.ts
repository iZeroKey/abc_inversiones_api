import { z } from "zod";

const optionalNullableText = z.string().trim().optional().nullable();
const emailLike = z
  .preprocess((value) => value === "" ? null : value, z.email("Email inválido").optional().nullable());

export const maritalStatusSchema = z.enum(["single", "married", "unspecified"]);

export const selfUpdateUserSchema = z.strictObject({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  dni: optionalNullableText,
  address: optionalNullableText,
  bank: optionalNullableText,
  bankAccounts: z.array(z.string().trim().min(1)).optional(),
  maritalStatus: maritalStatusSchema.optional().nullable(),
});

export const adminUpdateUserSchema = selfUpdateUserSchema.extend({
  email: emailLike,
  active: z.boolean().optional(),
});

export const adminCreateUserSchema = z.strictObject({
  publicCode: z.string().trim().min(1).optional(),
  email: emailLike,
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  createAuthAccount: z.boolean().optional().default(false),
  firstName: z.string().min(2, "El nombre es muy corto"),
  lastName: z.string().min(2, "El apellido es muy corto"),
  phone: optionalNullableText,
  role: z.enum(["client", "investor", "admin"]).default("client"),
  dni: optionalNullableText,
  address: optionalNullableText,
  bank: optionalNullableText,
  bankAccounts: z.array(z.string().trim().min(1)).optional().default([]),
  maritalStatus: maritalStatusSchema.optional().nullable(),
  active: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (data.createAuthAccount && !data.email) {
    ctx.addIssue({
      code: "custom",
      path: ["email"],
      message: "El email es obligatorio para crear cuenta de acceso",
    });
  }

  if (data.createAuthAccount && !data.password) {
    ctx.addIssue({
      code: "custom",
      path: ["password"],
      message: "La contraseña es obligatoria para crear cuenta de acceso",
    });
  }
});

export const linkAuthAccountSchema = z.strictObject({
  email: z.email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const updateAvatarSchema = z.object({
  avatarUrl: z.url("La URL del avatar debe ser válida"),
});

export type SelfUpdateUserDto = z.infer<typeof selfUpdateUserSchema>;
export type AdminUpdateUserDto = z.infer<typeof adminUpdateUserSchema>;
export type AdminCreateUserDto = z.infer<typeof adminCreateUserSchema>;
export type UpdateAvatarDto = z.infer<typeof updateAvatarSchema>;
export type LinkAuthAccountDto = z.infer<typeof linkAuthAccountSchema>;

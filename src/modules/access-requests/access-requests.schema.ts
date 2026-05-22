import { z } from "zod";

export const createAccessRequestSchema = z.object({
  email: z.email("Email inválido"),
  firstName: z.string().min(2, "El nombre es muy corto"),
  lastName: z.string().min(2, "El apellido es muy corto"),
  phone: z.string().min(7, "El teléfono es muy corto"),
  roleRequested: z.enum(["client", "investor"]),
  additionalData: z.record(z.string(), z.any()).optional().default({}),
});

export const updateRequestStatusSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("approved"),
    observation: z.string().optional(),
    initialPassword: z
      .string()
      .min(6, "La contraseña inicial debe tener al menos 6 caracteres"),
  }),
  z.object({
    status: z.enum(["pending", "in_review", "rejected"]),
    observation: z.string().optional(),
    initialPassword: z.string().optional(),
  }),
]);

export type CreateAccessRequestDto = z.infer<typeof createAccessRequestSchema>;
export type UpdateRequestStatusDto = z.infer<typeof updateRequestStatusSchema>;

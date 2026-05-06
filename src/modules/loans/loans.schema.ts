import { z } from "zod";

export const createLoanSchema = z.object({
  clientId: z.uuid("ID de cliente inválido"),
  investorId: z.uuid("ID de inversionista inválido").optional().nullable(),
  principal: z
    .string()
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "El monto debe ser positivo",
    ),
  interestRate: z
    .string()
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "La tasa de interés debe ser válida",
    ),
  interestType: z.literal("simple").default("simple"),
  interestPeriod: z.literal("monthly").default("monthly"),
  installmentsCount: z.coerce
    .number()
    .int()
    .min(1, "El número de cuotas debe ser positivo")
    .max(120, "El número de cuotas no puede superar 120"),
  frequency: z
    .enum(["daily", "weekly", "biweekly", "monthly"])
    .default("monthly"),
  startDate: z.iso.datetime({
    message: "La fecha de inicio es obligatoria",
    offset: true,
  }),
  observation: z.string().optional(),
});

export const updateLoanStatusSchema = z.object({
  status: z.enum([
    "pending_investor_review",
    "pending_admin_review",
    "active",
    "rejected",
    "paid",
    "defaulted",
  ]),
  observation: z.string().optional(),
});

export const rejectLoanSchema = z.object({
  observation: z.string().optional(),
});

export type CreateLoanDto = z.infer<typeof createLoanSchema>;
export type UpdateLoanStatusDto = z.infer<typeof updateLoanStatusSchema>;
export type RejectLoanDto = z.infer<typeof rejectLoanSchema>;

import { z } from "zod";

export const createLoanSchema = z.object({
  clientId: z.uuid("ID de cliente inválido"),
  investorId: z.uuid("ID de inversionista inválido").optional().nullable(),
  principal: z
    .string()
    .refine(
      (val) => Number.isFinite(Number(val)) && Number(val) > 0,
      "El monto debe ser positivo",
    ),
  interestRate: z
    .string()
    .refine(
      (val) => Number.isFinite(Number(val)) && Number(val) > 0,
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
  name: z
    .string()
    .max(255, "El nombre no puede superar 255 caracteres")
    .optional(),
  startDate: z.iso.datetime({
    message: "La fecha de inicio es obligatoria",
    offset: true,
  }),
  observation: z.string().optional(),
}).strict();

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

export const updateLoanSchema = z.strictObject({
  clientId: z.uuid("ID de cliente inválido").optional(),
  investorId: z.uuid("ID de inversionista inválido").optional().nullable(),
  principal: z
    .string()
    .refine(
      (val) => Number.isFinite(Number(val)) && Number(val) > 0,
      "El monto debe ser positivo",
    )
    .optional(),
  interestRate: z
    .string()
    .refine(
      (val) => Number.isFinite(Number(val)) && Number(val) > 0,
      "La tasa de interés debe ser válida",
    )
    .optional(),
  installmentsCount: z.coerce
    .number()
    .int()
    .min(1, "El número de cuotas debe ser positivo")
    .max(120, "El número de cuotas no puede superar 120")
    .optional(),
  name: z
    .string()
    .max(255, "El nombre no puede superar 255 caracteres")
    .optional()
    .nullable(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]).optional(),
  startDate: z.iso
    .datetime({
      message: "La fecha de inicio debe ser ISO8601",
      offset: true,
    })
    .optional(),
  observation: z.string().optional().nullable(),
});

export const rejectLoanSchema = z.object({
  observation: z.string().optional(),
});

export type CreateLoanDto = z.infer<typeof createLoanSchema>;
export type UpdateLoanDto = z.infer<typeof updateLoanSchema>;
export type UpdateLoanStatusDto = z.infer<typeof updateLoanStatusSchema>;
export type RejectLoanDto = z.infer<typeof rejectLoanSchema>;

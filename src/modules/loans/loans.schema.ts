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
  interestType: z.enum(["simple", "compound"]).default("simple"),
  interestPeriod: z.enum(["monthly", "annual"]).default("monthly"),
  installmentsCount: z
    .number()
    .int()
    .positive("El número de cuotas debe ser positivo"),
  frequency: z
    .enum(["daily", "weekly", "biweekly", "monthly"])
    .default("monthly"),
  paymentDay: z.number().int().min(1).max(31).optional(),
  startDate: z.iso.datetime().optional(),
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

export type CreateLoanDto = z.infer<typeof createLoanSchema>;
export type UpdateLoanStatusDto = z.infer<typeof updateLoanStatusSchema>;

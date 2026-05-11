import { z } from "zod";

export const createPaymentSchema = z.object({
  loanId: z.uuid("ID de préstamo inválido"),
  installmentId: z.uuid("ID de cuota inválido").optional().nullable(),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "El monto debe ser positivo"),
  paymentDate: z.iso.datetime().optional(),
  method: z.enum(["cash", "transfer", "deposit", "other"]).default("cash"),
  reference: z.string().optional(),
  observation: z.string().optional(),
});

export const updatePaymentSchema = z.strictObject({
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "El monto debe ser positivo").optional(),
  paymentDate: z.iso.datetime().optional(),
  method: z.enum(["cash", "transfer", "deposit", "other"]).optional(),
  reference: z.string().optional().nullable(),
  observation: z.string().optional().nullable(),
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentDto = z.infer<typeof updatePaymentSchema>;

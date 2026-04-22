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

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;

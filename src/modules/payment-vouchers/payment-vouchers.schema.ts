import { z } from "zod";

export const createVoucherSchema = z.object({
  loanId: z.uuid("ID de préstamo inválido"),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "El monto debe ser positivo"),
  operationId: z.string().min(1, "El ID de operación es obligatorio"),
  operationDate: z.string().datetime().optional(),
  evidenceUrl: z.string().url("URL de evidencia inválida").optional().nullable(),
  observation: z.string().optional(),
});

export const processVoucherSchema = z.object({
  action: z.enum(["approve", "reject"]),
  observation: z.string().optional(),
});

export type CreateVoucherDto = z.infer<typeof createVoucherSchema>;
export type ProcessVoucherDto = z.infer<typeof processVoucherSchema>;

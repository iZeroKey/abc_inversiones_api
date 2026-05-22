import { z } from "zod";

export const normalizeOperationId = (value: string): string => {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};

const operationDateSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return value;
  }, z.coerce.date().optional())
  .refine((value) => !value || !Number.isNaN(value.getTime()), {
    message: "La fecha de operación es inválida",
  })
  .refine((value) => !value || value.getTime() <= Date.now(), {
    message: "La fecha de operación no puede ser futura",
  });

const operationIdSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    return normalizeOperationId(value);
  },
  z.string().min(1, "El ID de operación es obligatorio"),
);

export const createVoucherSchema = z.strictObject({
  loanId: z.uuid("ID de préstamo inválido"),
  amount: z
    .string()
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "El monto debe ser positivo",
    ),
  operationId: operationIdSchema,
  operationDate: operationDateSchema,
  evidenceUrl: z
    .string()
    .url("URL de evidencia inválida")
    .optional()
    .nullable(),
  observation: z.string().optional(),
});

export const operationIdLookupSchema = z.object({
  operationId: operationIdSchema,
});

export const processVoucherSchema = z.object({
  action: z.enum(["approve", "reject"]),
  observation: z.string().optional(),
});

export const updateVoucherSchema = z.strictObject({
  amount: z
    .string()
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "El monto debe ser positivo",
    )
    .optional(),
  operationId: operationIdSchema.optional(),
  operationDate: operationDateSchema,
  evidenceUrl: z
    .string()
    .url("URL de evidencia inválida")
    .optional()
    .nullable(),
  observation: z.string().optional().nullable(),
});

export type CreateVoucherDto = z.infer<typeof createVoucherSchema>;
export type ProcessVoucherDto = z.infer<typeof processVoucherSchema>;
export type UpdateVoucherDto = z.infer<typeof updateVoucherSchema>;

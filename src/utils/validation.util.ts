import { z } from "zod";

export const PaginationParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
});

export const PaginationParamsMax = (maxLimit: number) =>
  PaginationParams.extend({
    limit: z.coerce.number().int().min(1).max(maxLimit).default(20),
  });

export const DateRangeParams = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export const SearchParams = z.object({
  q: z.string().max(100).optional(),
  search: z.string().max(100).optional(),
});

export const UUIDParam = z.object({
  id: z.string().uuid("ID inválido"),
});

export const UUIDRouteParam = (name: string) =>
  z.object({
    [name]: z.string().uuid(`ID de ${name} inválido`),
  });

export const DateRangeFromTo = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const parsePositiveInt = (
  value: unknown,
  fallback: number,
  max?: number,
): number => {
  const raw =
    typeof value === "string"
      ? value
      : Array.isArray(value) && typeof value[0] === "string"
        ? value[0]
        : "";
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return max ? Math.min(parsed, max) : parsed;
};

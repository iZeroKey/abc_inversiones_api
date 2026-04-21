import type { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../core/errors/app-error.js";
import { sendSuccess } from "../../core/utils/response.util.js";
import { loginSchema, refreshSchema } from "./auth.schema.js";

const mapZodIssues = (error: ZodError): unknown[] => {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
};

export const login = (request: Request, _response: Response): never => {
  const parsed = loginSchema.safeParse(request.body);

  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Validacion fallida",
      mapZodIssues(parsed.error),
    );
  }

  throw new AppError(
    501,
    "AUTH_NOT_IMPLEMENTED",
    "Login pendiente de implementacion",
  );
};

export const logout = (_request: Request, _response: Response): never => {
  throw new AppError(
    501,
    "AUTH_NOT_IMPLEMENTED",
    "Logout pendiente de implementacion",
  );
};

export const refresh = (request: Request, _response: Response): never => {
  const parsed = refreshSchema.safeParse(request.body);

  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Validacion fallida",
      mapZodIssues(parsed.error),
    );
  }

  throw new AppError(
    501,
    "AUTH_NOT_IMPLEMENTED",
    "Refresh pendiente de implementacion",
  );
};

export const me = (_request: Request, response: Response): Response => {
  return sendSuccess(response, 200, "Operacion exitosa", {
    user: null,
    note: "Endpoint base listo; autenticacion real se implementa en el siguiente paso",
  });
};

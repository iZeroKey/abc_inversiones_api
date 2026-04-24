import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response.util.js";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void next;

  const errorData =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : null;
  const status =
    (typeof errorData?.status === "number" && errorData.status) ||
    (typeof errorData?.statusCode === "number" && errorData.statusCode) ||
    500;
  const message =
    (typeof errorData?.message === "string" && errorData.message) ||
    "Error interno del servidor";

  console.error("[Error Handler]", {
    status,
    message,
    stack: error instanceof Error ? error.stack : null,
    data: errorData?.data || null,
  });

  sendError(res, status, message, errorData?.data || null);
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, 404, "Recurso no encontrado");
};

import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger.js";
import { sendError } from "../utils/response.util.js";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
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

  if (status >= 500) {
    logger.error(
      { err: error instanceof Error ? error : null, status, message },
      "Internal server error",
    );
  } else {
    logger.warn(
      { status, message, data: errorData?.data },
      "Client error",
    );
  }

  sendError(res, status, message, errorData?.data || null);
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, 404, "Recurso no encontrado");
};
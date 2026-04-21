import type { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response.util.js";

type ErrorWithStatus = Error & {
  statusCode?: number;
  code?: string;
  details?: unknown[];
};

export const errorHandler = (
  error: ErrorWithStatus,
  _request: Request,
  response: Response,
  _next: NextFunction,
): Response => {
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? "INTERNAL_SERVER_ERROR";
  const message =
    statusCode === 500 ? "Error interno del servidor" : error.message;

  return sendError(response, statusCode, message, code, error.details ?? []);
};

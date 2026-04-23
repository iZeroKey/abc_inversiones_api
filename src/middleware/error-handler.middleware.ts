import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response.util.js";

export const errorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Error interno del servidor";

  console.error("[Error Handler]", {
    status,
    message,
    stack: error?.stack,
    data: error?.data || null,
  });

  sendError(res, status, message, error.data || null);
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, 404, "Recurso no encontrado");
};

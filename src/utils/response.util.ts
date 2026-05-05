import { Response } from "express";
import { ZodError } from "zod";
import { DateTime } from "luxon";
import { env } from "../config/env.js";

export interface ApiResponse<T = unknown, M extends Record<string, unknown> = Record<string, unknown>> {
  success: boolean;
  message: string;
  data?: T;
  meta: {
    timestamp: string;
  } & M;
}

const getTimestamp = () => {
  return DateTime.now().setZone(env.APP_TIMEZONE).toISO() || new Date().toISOString();
};

export const sendSuccess = <
  T,
  M extends Record<string, unknown> = Record<string, unknown>,
>(
  res: Response,
  status: number,
  message: string,
  data?: T,
  meta?: M,
): void => {
  const response: ApiResponse<T, M> = {
    success: true,
    message,
    data,
    meta: {
      ...meta,
      timestamp: getTimestamp(),
    } as ApiResponse<T, M>["meta"],
  };
  res.status(status).json(response);
};

export const sendError = (
  res: Response,
  status: number,
  message: string,
  error?: unknown
): void => {
  const isProduction = env.NODE_ENV === "production";
  const shouldHideServerError = isProduction && status >= 500;

  const response: ApiResponse<unknown | null> = {
    success: false,
    message: shouldHideServerError ? "Error interno del servidor" : message,
    data: shouldHideServerError ? null : (error || null),
    meta: {
      timestamp: getTimestamp(),
    },
  };
  res.status(status).json(response);
};

export const formatZodError = (error: ZodError) => {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
};

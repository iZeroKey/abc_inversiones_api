import { Response } from "express";
import { ZodError } from "zod";
import { DateTime } from "luxon";
import { env } from "../config/env.js";

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta: {
    timestamp: string;
  };
}

const getTimestamp = () => {
  return DateTime.now().setZone(env.APP_TIMEZONE).toISO() || new Date().toISOString();
};

export const sendSuccess = <T>(
  res: Response,
  status: number,
  message: string,
  data?: T
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta: {
      timestamp: getTimestamp(),
    },
  };
  res.status(status).json(response);
};

export const sendError = (
  res: Response,
  status: number,
  message: string,
  error?: any
): void => {
  const isProduction = env.NODE_ENV === "production";
  const shouldHideServerError = isProduction && status >= 500;

  const response: ApiResponse = {
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

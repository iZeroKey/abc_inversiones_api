import type { Response } from "express";

type SuccessPayload<T> = {
  success: true;
  message: string;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
};

type ErrorPayload = {
  success: false;
  message: string;
  error: {
    code: string;
    details: unknown[];
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
};

const buildMeta = (response: Response) => ({
  requestId: response.locals.requestId as string,
  timestamp: new Date().toISOString(),
});

export const sendSuccess = <T>(
  response: Response,
  statusCode: number,
  message: string,
  data: T,
): Response<SuccessPayload<T>> => {
  return response.status(statusCode).json({
    success: true,
    message,
    data,
    meta: buildMeta(response),
  });
};

export const sendError = (
  response: Response,
  statusCode: number,
  message: string,
  code: string,
  details: unknown[] = [],
): Response<ErrorPayload> => {
  return response.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      details,
    },
    meta: buildMeta(response),
  });
};

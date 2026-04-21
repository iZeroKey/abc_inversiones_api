import type { Request, Response } from "express";
import { sendSuccess } from "../../core/utils/response.util.js";

export const getHealth = (_request: Request, response: Response): Response => {
  return sendSuccess(response, 200, "Operacion exitosa", {
    status: "ok",
    service: "abc-inversiones-api",
  });
};

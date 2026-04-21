import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/response.util.js";

export const getHealth = (_request: Request, response: Response): void => {
  sendSuccess(response, 200, "Operación exitosa", {
    status: "ok",
    service: "abc-inversiones-api",
  });
};

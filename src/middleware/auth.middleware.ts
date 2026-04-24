import { NextFunction, Request, Response } from "express";
import { users } from "../db/schema/users.js";
import { sendError } from "../utils/response.util.js";
import { resolveAuthenticatedUser } from "./auth.helpers.js";

export interface AuthRequest extends Request {
  user?: typeof users.$inferSelect;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      sendError(res, 401, "No se proporcionó token de autenticación");
      return;
    }

    const token = authHeader.split(" ")[1];
    const { user, status, message } = await resolveAuthenticatedUser(token);

    if (!user) {
      sendError(res, status, message);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    sendError(res, 500, "Error en la autenticación", error);
  }
};

import { NextFunction, Response } from "express";
import { sendError } from "../utils/response.util.js";
import { AuthRequest } from "./auth.middleware.js";

export const authorize = (roles: string[], allowOwner = true) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, "Usuario no autenticado");
      return;
    }

    // El Dueño (isOwner) tiene acceso total siempre si allowOwner es true
    if (allowOwner && req.user.isOwner) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 403, "No tienes permisos para realizar esta acción");
      return;
    }

    next();
  };
};

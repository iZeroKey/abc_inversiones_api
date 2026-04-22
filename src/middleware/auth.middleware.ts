import { eq } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import { db } from "../config/db.js";
import { supabase } from "../config/supabase.js";
import { users } from "../db/schema/users.js";
import { sendError } from "../utils/response.util.js";

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
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !authUser) {
      sendError(res, 401, "Token inválido o expirado");
      return;
    }

    // Buscamos el usuario en nuestra DB para tener sus roles y permisos
    const [localUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!localUser || !localUser.active) {
      sendError(res, 403, "Usuario no encontrado o inactivo");
      return;
    }

    req.user = localUser;
    next();
  } catch (error) {
    sendError(res, 500, "Error en la autenticación", error);
  }
};

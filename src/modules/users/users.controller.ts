import { and, eq, isNull } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import { updateUserSchema } from "./users.schema.js";

export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const allUsers = await db
      .select()
      .from(users)
      .where(isNull(users.deletedAt));

    sendSuccess(res, 200, "Usuarios obtenidos exitosamente", allUsers);
  } catch (error) {
    sendError(res, 500, "Error al obtener usuarios", error);
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  sendSuccess(res, 200, "Perfil obtenido exitosamente", req.user);
};

export const getUserById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    sendSuccess(res, 200, "Usuario obtenido exitosamente", user);
  } catch (error) {
    sendError(res, 500, "Error al obtener usuario", error);
  }
};

export const updateUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validation = updateUserSchema.safeParse(req.body);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    // Seguridad: Solo Admin o el propio usuario pueden editar
    // El Owner puede editar a cualquiera
    if (
      req.user?.id !== id &&
      req.user?.role !== "admin" &&
      !req.user?.isOwner
    ) {
      sendError(res, 403, "No tienes permiso para actualizar este usuario");
      return;
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    sendSuccess(res, 200, "Usuario actualizado exitosamente", updatedUser);
  } catch (error) {
    sendError(res, 500, "Error al actualizar usuario", error);
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Solo Admin u Owner pueden borrar (soft delete)
    if (req.user?.role !== "admin" && !req.user?.isOwner) {
      sendError(res, 403, "No tienes permiso para eliminar usuarios");
      return;
    }

    const [deletedUser] = await db
      .update(users)
      .set({
        active: false,
        deletedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!deletedUser) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    sendSuccess(res, 200, "Usuario eliminado (desactivado) exitosamente");
  } catch (error) {
    sendError(res, 500, "Error al eliminar usuario", error);
  }
};

import { Response } from "express";
import { db } from "../../config/db.js";
import { users } from "../../db/schema/users.js";
import { eq, desc } from "drizzle-orm";
import {
  sendSuccess,
  sendError,
  formatZodError,
} from "../../utils/response.util.js";
import { updateUserSchema } from "./users.schema.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import { uploadAvatar } from "../../utils/storage.util.js";

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    sendSuccess(res, 200, "Perfil obtenido", user);
  } catch (error) {
    sendError(res, 500, "Error al obtener perfil", error);
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const results = await db.select().from(users).orderBy(desc(users.createdAt));
    sendSuccess(res, 200, "Usuarios obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener usuarios", error);
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    sendSuccess(res, 200, "Usuario obtenido", user);
  } catch (error) {
    sendError(res, 500, "Error al obtener usuario", error);
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const currentUser = req.user!;

    if (currentUser.id !== id && currentUser.role !== "admin") {
      sendError(res, 403, "No tienes permiso para actualizar este usuario");
      return;
    }

    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [oldUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    const [updatedUser] = await db
      .update(users)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    await logAudit({
      userId: currentUser.id,
      action: "UPDATE_USER",
      module: "USERS",
      entityId: id,
      oldData: oldUser,
      newData: updatedUser,
      req,
    });

    sendSuccess(res, 200, "Usuario actualizado correctamente", updatedUser);
  } catch (error) {
    sendError(res, 500, "Error al actualizar usuario", error);
  }
};

/**
 * Actualizar foto de perfil.
 * Acepta imagen como multipart/form-data en el campo "avatar".
 * La imagen se sube a Supabase Storage en: avatars/{userId}/avatar.{ext}
 */
export const updateAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const file = req.file; // multer

    if (!file) {
      sendError(res, 400, "Debes adjuntar una imagen en el campo 'avatar'");
      return;
    }

    const avatarUrl = await uploadAvatar(
      user.id,
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    const [updatedUser] = await db
      .update(users)
      .set({
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    await logAudit({
      userId: user.id,
      action: "UPDATE_AVATAR",
      module: "USERS",
      entityId: user.id,
      newData: { avatarUrl },
      req,
    });

    sendSuccess(res, 200, "Foto de perfil actualizada correctamente", updatedUser);
  } catch (error) {
    sendError(res, 500, "Error al actualizar avatar", error);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    const [deletedUser] = await db
      .update(users)
      .set({
        active: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      action: "DELETE_USER",
      module: "USERS",
      entityId: id,
      req,
    });

    sendSuccess(res, 200, "Usuario desactivado correctamente", deletedUser);
  } catch (error) {
    sendError(res, 500, "Error al desactivar usuario", error);
  }
};

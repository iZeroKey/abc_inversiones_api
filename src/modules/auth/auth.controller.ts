import { eq } from "drizzle-orm";
import { Request, Response } from "express";
import { db } from "../../config/db.js";
import { supabase, supabaseAdmin } from "../../config/supabase.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import { loginSchema, registerSchema, changePasswordSchema } from "./auth.schema.js";

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const { email, password } = validation.data;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      sendError(res, 401, "Credenciales incorrectas", error.message);
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, data.user.id))
      .limit(1);

    sendSuccess(res, 200, "Login exitoso", {
      user: user || null,
      session: data.session,
    });
  } catch (error) {
    sendError(res, 500, "Error interno del servidor", error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      sendError(res, 500, "Error al cerrar sesión", error.message);
      return;
    }
    sendSuccess(res, 200, "Sesión cerrada correctamente");
  } catch (error) {
    sendError(res, 500, "Error interno del servidor", error);
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const { email, password, firstName, lastName, phone, role, isOwner } =
      validation.data;

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone,
        phone_confirm: !!phone,
      });

    if (authError) {
      sendError(res, 400, "Error en Supabase Auth", authError.message);
      return;
    }

    const [user] = await db
      .insert(users)
      .values({
        id: authData.user!.id,
        email,
        phone,
        firstName,
        lastName,
        role,
        isOwner,
      })
      .returning();

    sendSuccess(res, 201, "Usuario registrado exitosamente", { user });
  } catch (error) {
    sendError(res, 500, "Error interno del servidor", error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const { currentPassword, newPassword } = validation.data;
    const userEmail = req.user?.email;

    if (!userEmail) {
      sendError(res, 401, "Usuario no identificado");
      return;
    }

    // 1. Verificar la contraseña actual intentando un login silencioso
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (verifyError) {
      sendError(res, 401, "La contraseña actual es incorrecta");
      return;
    }

    // 2. Actualizar a la nueva contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      sendError(res, 400, "Error al actualizar la contraseña", updateError.message);
      return;
    }

    sendSuccess(res, 200, "Contraseña actualizada correctamente");
  } catch (error) {
    sendError(res, 500, "Error interno del servidor", error);
  }
};

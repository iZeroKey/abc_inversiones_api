import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { supabaseAdmin } from "../config/supabase.js";
import { users } from "../db/schema/users.js";

export interface AuthResolutionResult {
  user: typeof users.$inferSelect | null;
  status: number;
  message: string;
}

export const resolveAuthenticatedUser = async (
  token: string,
): Promise<AuthResolutionResult> => {
  if (!token) {
    return {
      user: null,
      status: 401,
      message: "No se proporcionó token de autenticación",
    };
  }

  const {
    data: { user: authUser },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !authUser) {
    return {
      user: null,
      status: 401,
      message: "Token inválido o expirado",
    };
  }

  const [localUser] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, authUser.id))
    .limit(1);

  if (!localUser || !localUser.active) {
    return {
      user: null,
      status: 403,
      message: "Usuario no encontrado o inactivo",
    };
  }

  return {
    user: localUser,
    status: 200,
    message: "OK",
  };
};

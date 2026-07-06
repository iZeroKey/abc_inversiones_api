import {
  and,
  desc,
  eq,
  getTableColumns,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { loans } from "../../db/schema/loans.js";
import { paymentVouchers } from "../../db/schema/payment-vouchers.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { logAudit } from "../../utils/audit.util.js";
import {
  generatePublicCodeForRole,
  parsePublicCodeNumber,
  publicCodeKindForRole,
} from "../../utils/public-code.util.js";
import { emitUserDomainEvent } from "../../utils/realtime.util.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import {
  attachSignedUrls,
  deleteStorageReference,
  finalizeAvatarUpload,
} from "../../utils/storage.util.js";
import { PaginationParamsMax } from "../../utils/validation.util.js";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  linkAuthAccountSchema,
  selfUpdateUserSchema,
} from "./users.schema.js";

const selfForbiddenFields = new Set([
  "id",
  "authUserId",
  "publicCode",
  "email",
  "avatarUrl",
  "role",
  "active",
  "isOwner",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const normalizeNullableText = (
  value: string | null | undefined,
): string | null | undefined => {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeUserPayload = <T extends Record<string, unknown>>(
  data: T,
): T => {
  const normalized = { ...data };
  for (const field of ["email", "phone", "dni", "address", "bank"] as const) {
    if (field in normalized) {
      (normalized as Record<string, unknown>)[field] = normalizeNullableText(
        normalized[field] as string | null | undefined,
      );
    }
  }

  return normalized;
};

const attachSignedAvatarUrl = async <T extends { avatarUrl?: string | null }>(
  user: T,
): Promise<T> => {
  if (!user.avatarUrl?.startsWith("storage://")) {
    return user;
  }
  const [resolved] = await attachSignedUrls([user as never], "avatarUrl");
  return resolved as unknown as T;
};

const canManageTargetUser = (
  currentUser: typeof users.$inferSelect,
  targetUser: typeof users.$inferSelect,
): boolean => {
  if (currentUser.isOwner) {
    return true;
  }

  if (currentUser.id === targetUser.id) {
    return true;
  }

  return currentUser.role === "admin" && targetUser.role !== "admin";
};

const canUseAdministrativeUpdate = (
  currentUser: typeof users.$inferSelect,
  targetUser: typeof users.$inferSelect,
): boolean => {
  if (currentUser.isOwner) {
    return true;
  }

  return (
    currentUser.role === "admin" &&
    currentUser.id !== targetUser.id &&
    targetUser.role !== "admin"
  );
};

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const movePendingInvestorVouchersToAdminReviewInTransaction = async (
  tx: DbTransaction,
  investorId: string,
): Promise<number> => {
  const updated = await tx
    .update(paymentVouchers)
    .set({
      status: "pending_admin_review",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentVouchers.status, "pending_investor_review"),
        sql`EXISTS (
        SELECT 1
        FROM ${loans}
        WHERE ${loans.id} = ${paymentVouchers.loanId}
          AND ${loans.investorId} = ${investorId}
      )`,
      ),
    )
    .returning({ id: paymentVouchers.id });

  return updated.length;
};

const movePendingInvestorVouchersToAdminReview = async (
  investorId: string,
): Promise<number> => {
  const updated = await db
    .update(paymentVouchers)
    .set({
      status: "pending_admin_review",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentVouchers.status, "pending_investor_review"),
        sql`EXISTS (
        SELECT 1
        FROM ${loans}
        WHERE ${loans.id} = ${paymentVouchers.loanId}
          AND ${loans.investorId} = ${investorId}
      )`,
      ),
    )
    .returning({ id: paymentVouchers.id });

  return updated.length;
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const responseUser = await attachSignedAvatarUrl(user);
    sendSuccess(res, 200, "Perfil obtenido", responseUser);
  } catch (error) {
    sendError(res, 500, "Error al obtener perfil", error);
  }
};

export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const params = PaginationParamsMax(100).safeParse(req.query);
    if (!params.success) {
      sendError(res, 400, "Parámetros inválidos", formatZodError(params.error));
      return;
    }
    const { page, limit } = params.data;
    const offset = (page - 1) * limit;

    const { role, active, q, search } = req.query;

    const conditions: SQL[] = [sql`${users.deletedAt} IS NULL`];

    if (role) conditions.push(sql`${users.role} = ${role as string}`);
    if (active !== undefined) {
      if (active === "true") conditions.push(eq(users.active, true));
      else if (active === "false") conditions.push(eq(users.active, false));
    }

    const searchTerm =
      typeof search === "string"
        ? search.trim()
        : typeof q === "string"
          ? q.trim()
          : "";

    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      conditions.push(
        or(
          ilike(users.publicCode, pattern),
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(users.email, pattern),
          ilike(users.phone, pattern),
          ilike(users.dni, pattern),
          ilike(users.bank, pattern),
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(where);

    const total = countRow?.total ?? 0;

    const results = await db
      .select(getTableColumns(users))
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const signedResults = await attachSignedUrls(
      results,
      "avatarUrl",
      "avatars",
    );

    sendSuccess(res, 200, "Usuarios obtenidos", signedResults, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener usuarios", error);
  }
};

export const createUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const validation = adminCreateUserSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const currentUser = req.user!;
    const data = normalizeUserPayload(validation.data);

    if (!currentUser.isOwner && data.role === "admin") {
      sendError(res, 403, "Solo un owner puede crear administradores");
      return;
    }

    if (
      data.publicCode &&
      parsePublicCodeNumber(data.publicCode, publicCodeKindForRole(data.role)) <
        1
    ) {
      sendError(res, 400, "Código público inválido para el rol indicado");
      return;
    }

    let authUserId: string | null = null;
    if (data.createAuthAccount) {
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: data.email!,
          password: data.password!,
          email_confirm: true,
          phone: data.phone || undefined,
          phone_confirm: !!data.phone,
        });

      if (authError || !authData.user) {
        sendError(res, 400, "Error en Supabase Auth", authError?.message);
        return;
      }

      authUserId = authData.user.id;
    }

    let createdUser: typeof users.$inferSelect;
    try {
      [createdUser] = await db
        .insert(users)
        .values({
          authUserId,
          publicCode:
            data.publicCode || (await generatePublicCodeForRole(data.role)),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          active: data.active,
          dni: data.dni,
          address: data.address,
          bank: data.bank,
          bankAccounts: data.bankAccounts,
          maritalStatus: data.maritalStatus,
        })
        .returning();
    } catch (error) {
      if (authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw error;
    }

    await logAudit({
      userId: currentUser.id,
      action: "CREATE_USER",
      module: "USERS",
      entityId: createdUser.id,
      newData: createdUser,
      req,
    });

    emitUserDomainEvent("user.created", {
      userId: createdUser.id,
      role: createdUser.role,
      active: createdUser.active,
    });

    sendSuccess(res, 201, "Usuario creado correctamente", createdUser);
  } catch (error) {
    sendError(res, 500, "Error al crear usuario", error);
  }
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
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    if (!canManageTargetUser(req.user!, user)) {
      sendError(res, 403, "No tienes permiso para gestionar este usuario");
      return;
    }

    const responseUser = await attachSignedAvatarUrl(user);
    sendSuccess(res, 200, "Usuario obtenido", responseUser);
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
    const currentUser = req.user!;

    const [oldUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!oldUser) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    if (!canManageTargetUser(currentUser, oldUser)) {
      sendError(res, 403, "No tienes permiso para gestionar este usuario");
      return;
    }

    if ("role" in req.body) {
      sendError(res, 400, "No se puede modificar el rol de un usuario");
      return;
    }

    const useAdminSchema = canUseAdministrativeUpdate(currentUser, oldUser);

    if (!useAdminSchema) {
      const forbiddenFields = Object.keys(req.body).filter((field) =>
        selfForbiddenFields.has(field),
      );

      if (forbiddenFields.length > 0) {
        sendError(
          res,
          400,
          "No puedes modificar campos administrativos en tu perfil",
          {
            fields: forbiddenFields,
          },
        );
        return;
      }
    }

    const validation = (
      useAdminSchema ? adminUpdateUserSchema : selfUpdateUserSchema
    ).safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const updateData = normalizeUserPayload(validation.data);
    const publicCode =
      oldUser.publicCode || (await generatePublicCodeForRole(oldUser.role));
    const isRemovingInvestorAccess =
      oldUser.role === "investor" &&
      oldUser.active &&
      "active" in updateData &&
      updateData.active === false;

    const { updatedUser, movedVouchers } = await db.transaction(async (tx) => {
      const [updatedUser] = await tx
        .update(users)
        .set({
          ...updateData,
          publicCode,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      const movedVouchers = isRemovingInvestorAccess
        ? await movePendingInvestorVouchersToAdminReviewInTransaction(tx, id)
        : 0;

      return { updatedUser, movedVouchers };
    });

    await logAudit({
      userId: currentUser.id,
      action: "UPDATE_USER",
      module: "USERS",
      entityId: id,
      oldData: oldUser,
      newData: {
        ...updatedUser,
        movedPendingVouchersToAdminReview: movedVouchers,
      },
      req,
    });

    const responseUser = await attachSignedAvatarUrl(updatedUser);
    emitUserDomainEvent("user.updated", {
      userId: updatedUser.id,
      role: updatedUser.role,
      active: updatedUser.active,
    });
    sendSuccess(res, 200, "Usuario actualizado correctamente", responseUser);
  } catch (error) {
    sendError(res, 500, "Error al actualizar usuario", error);
  }
};

export const linkAuthAccount = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const currentUser = req.user!;
    const validation = linkAuthAccountSchema.safeParse(req.body);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!targetUser) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    if (!canUseAdministrativeUpdate(currentUser, targetUser)) {
      sendError(res, 403, "No tienes permiso para vincular cuenta de acceso");
      return;
    }

    if (targetUser.authUserId) {
      sendError(res, 400, "El usuario ya tiene cuenta de acceso vinculada");
      return;
    }

    const { email, password } = validation.data;
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone: targetUser.phone || undefined,
        phone_confirm: !!targetUser.phone,
      });

    if (authError || !authData.user) {
      sendError(res, 400, "Error en Supabase Auth", authError?.message);
      return;
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        authUserId: authData.user.id,
        email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    await logAudit({
      userId: currentUser.id,
      action: "LINK_AUTH_ACCOUNT",
      module: "USERS",
      entityId: id,
      oldData: targetUser,
      newData: updatedUser,
      req,
    });

    emitUserDomainEvent("user.updated", {
      userId: updatedUser.id,
      role: updatedUser.role,
      active: updatedUser.active,
    });

    sendSuccess(
      res,
      200,
      "Cuenta de acceso vinculada correctamente",
      updatedUser,
    );
  } catch (error) {
    sendError(res, 500, "Error al vincular cuenta de acceso", error);
  }
};

/**
 * Actualizar foto de perfil.
 * Acepta imagen como multipart/form-data en el campo "avatar".
 * La imagen se sube a Supabase Storage en: avatars/{userId}/avatar.{ext}
 *
 * Usa reemplazo seguro: sube a ruta temporal, elimina la anterior,
 * luego sube a ruta canónica. Si algo falla, el avatar anterior se preserva.
 */
export const updateAvatar = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;

    const fileStream = req.streamParsed?.fileStream;

    if (!fileStream) {
      sendError(res, 400, "Debes adjuntar una imagen en el campo 'avatar'");
      return;
    }

    const tempStorageRef = await fileStream.uploadPromise;
    const avatarUrl = await finalizeAvatarUpload(user.id, tempStorageRef);

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

    const responseUser = await attachSignedAvatarUrl(updatedUser);
    emitUserDomainEvent("user.updated", {
      userId: updatedUser.id,
      role: updatedUser.role,
      active: updatedUser.active,
    });
    sendSuccess(
      res,
      200,
      "Foto de perfil actualizada correctamente",
      responseUser,
    );
  } catch (error) {
    sendError(res, 500, "Error al actualizar avatar", error);
  }
};

/**
 * Eliminar foto de perfil del usuario autenticado.
 * Borra el objeto de Supabase Storage cuando la referencia actual es interna
 * y limpia avatarUrl en la tabla users.
 */
export const deleteAvatar = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user!;

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!currentUser) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    await deleteStorageReference(currentUser.avatarUrl);

    const [updatedUser] = await db
      .update(users)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    await logAudit({
      userId: user.id,
      action: "DELETE_AVATAR",
      module: "USERS",
      entityId: user.id,
      oldData: { avatarUrl: currentUser.avatarUrl },
      newData: { avatarUrl: null },
      req,
    });

    emitUserDomainEvent("user.updated", {
      userId: updatedUser.id,
      role: updatedUser.role,
      active: updatedUser.active,
    });

    sendSuccess(
      res,
      200,
      "Foto de perfil eliminada correctamente",
      updatedUser,
    );
  } catch (error) {
    sendError(res, 500, "Error al eliminar avatar", error);
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!targetUser) {
      sendError(res, 404, "Usuario no encontrado");
      return;
    }

    if (!canManageTargetUser(req.user!, targetUser)) {
      sendError(res, 403, "No tienes permiso para gestionar este usuario");
      return;
    }

    const { deletedUser, movedVouchers } = await db.transaction(async (tx) => {
      const [deletedUser] = await tx
        .update(users)
        .set({
          active: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      const movedVouchers =
        targetUser.role === "investor"
          ? await movePendingInvestorVouchersToAdminReviewInTransaction(tx, id)
          : 0;

      return { deletedUser, movedVouchers };
    });

    await logAudit({
      userId: req.user!.id,
      action: "DELETE_USER",
      module: "USERS",
      entityId: id,
      newData: { movedPendingVouchersToAdminReview: movedVouchers },
      req,
    });

    emitUserDomainEvent("user.deleted", {
      userId: deletedUser.id,
      role: deletedUser.role,
      active: deletedUser.active,
    });

    sendSuccess(res, 200, "Usuario desactivado correctamente", deletedUser);
  } catch (error) {
    sendError(res, 500, "Error al desactivar usuario", error);
  }
};

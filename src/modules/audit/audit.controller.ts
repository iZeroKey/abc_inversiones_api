import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { auditLogs } from "../../db/schema/audit-logs.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";

const auditLogSelection = {
  id: auditLogs.id,
  userId: auditLogs.userId,
  action: auditLogs.action,
  module: auditLogs.module,
  entityId: auditLogs.entityId,
  oldData: auditLogs.oldData,
  newData: auditLogs.newData,
  ipAddress: auditLogs.ipAddress,
  userAgent: auditLogs.userAgent,
  createdAt: auditLogs.createdAt,
  user: {
    id: users.id,
    publicCode: users.publicCode,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
    phone: users.phone,
    dni: users.dni,
    role: users.role,
    active: users.active,
    avatarUrl: users.avatarUrl,
  },
};

const parsePositiveInt = (
  value: unknown,
  fallback: number,
  max?: number,
): number => {
  const raw =
    typeof value === "string"
      ? value
      : Array.isArray(value) && typeof value[0] === "string"
        ? value[0]
        : "";
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return max ? Math.min(parsed, max) : parsed;
};

/**
 * Listar logs de auditoría con filtros opcionales.
 * Query params: module, action, userId, from, to, limit
 */
export const getAuditLogs = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { module, action, userId, from, to } = req.query;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (module) conditions.push(eq(auditLogs.module, module as string));
    if (action) conditions.push(eq(auditLogs.action, action as string));
    if (userId) conditions.push(eq(auditLogs.userId, userId as string));
    if (from)
      conditions.push(gte(auditLogs.createdAt, new Date(from as string)));
    if (to) conditions.push(lte(auditLogs.createdAt, new Date(to as string)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const countExpression = sql<number>`count(*)`.mapWith(Number);
    const [totalRow] = await db
      .select({ total: countExpression })
      .from(auditLogs)
      .where(where);
    const results = await db
      .select(auditLogSelection)
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const total = totalRow?.total || 0;
    sendSuccess(res, 200, "Logs de auditoría obtenidos", results, {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener logs de auditoría", error);
  }
};

/**
 * Obtener logs de un usuario específico.
 */
export const getAuditLogsByUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.params.userId as string;

    const results = await db
      .select(auditLogSelection)
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    sendSuccess(res, 200, "Logs del usuario obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener logs del usuario", error);
  }
};

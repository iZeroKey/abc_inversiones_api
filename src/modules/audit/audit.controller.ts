import { Response } from "express";
import { db } from "../../config/db.js";
import { auditLogs } from "../../db/schema/audit-logs.js";
import { eq, desc, and, gte, lte, type SQL } from "drizzle-orm";
import { sendSuccess, sendError } from "../../utils/response.util.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";

/**
 * Listar logs de auditoría con filtros opcionales.
 * Query params: module, action, userId, from, to, limit
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { module, action, userId, from, to, limit: limitParam } = req.query;
    const maxLimit = Math.min(Number(limitParam) || 50, 200);

    const conditions: SQL[] = [];
    if (module) conditions.push(eq(auditLogs.module, module as string));
    if (action) conditions.push(eq(auditLogs.action, action as string));
    if (userId) conditions.push(eq(auditLogs.userId, userId as string));
    if (from) conditions.push(gte(auditLogs.createdAt, new Date(from as string)));
    if (to) conditions.push(lte(auditLogs.createdAt, new Date(to as string)));

    const results = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(maxLimit);

    sendSuccess(res, 200, "Logs de auditoría obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener logs de auditoría", error);
  }
};

/**
 * Obtener logs de un usuario específico.
 */
export const getAuditLogsByUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;

    const results = await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    sendSuccess(res, 200, "Logs del usuario obtenidos", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener logs del usuario", error);
  }
};

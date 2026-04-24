import { db } from "../config/db.js";
import { auditLogs } from "../db/schema/audit-logs.js";
import { Request } from "express";

export interface AuditParams {
  userId?: string;
  action: string;
  module: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
  req?: Request;
}

/**
 * Registra una acción en la bitácora de auditoría
 */
export const logAudit = async (params: AuditParams) => {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      module: params.module,
      entityId: params.entityId,
      oldData: params.oldData,
      newData: params.newData,
      ipAddress: params.req?.ip || "unknown",
      userAgent: params.req?.get("user-agent") || "unknown",
    });
  } catch (error) {
    console.error("[AuditLog Error]:", error);
    // No lanzamos error para no detener el flujo principal del negocio
  }
};

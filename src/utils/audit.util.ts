import { Request } from "express";
import { db } from "../config/db.js";
import { auditLogs } from "../db/schema/audit-logs.js";
import { emitAuditDomainEvent } from "./realtime.util.js";

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
    const [auditLog] = await db
      .insert(auditLogs)
      .values({
        userId: params.userId,
        action: params.action,
        module: params.module,
        entityId: params.entityId,
        oldData: params.oldData,
        newData: params.newData,
        ipAddress: params.req?.ip || "unknown",
        userAgent: params.req?.get("user-agent") || "unknown",
      })
      .returning({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        module: auditLogs.module,
        entityId: auditLogs.entityId,
      });

    if (auditLog) {
      emitAuditDomainEvent({
        auditLogId: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        module: auditLog.module,
        entityId: auditLog.entityId,
      });
    }
  } catch (error) {
    console.error("[AuditLog Error]:", error);
    // No lanzamos error para no detener el flujo principal del negocio
  }
};

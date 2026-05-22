import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { notifications } from "../../db/schema/notifications.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { realtimeService } from "../../realtime/websocket.service.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const getQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

const parsePositiveInt = (
  value: unknown,
  defaultValue: number,
  max?: number,
): number => {
  const parsed = Number.parseInt(getQueryValue(value) || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue;
  }

  return max ? Math.min(parsed, max) : parsed;
};

export const getMyNotifications = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = (page - 1) * limit;
    const isReadParam = getQueryValue(req.query.isRead);
    const conditions: SQL[] = [eq(notifications.userId, userId)];

    if (isReadParam === "true") {
      conditions.push(eq(notifications.isRead, true));
    } else if (isReadParam === "false") {
      conditions.push(eq(notifications.isRead, false));
    }

    const where = and(...conditions);
    const countExpression = sql<number>`count(*)`.mapWith(Number);

    const [[totalRow], [unreadRow], results] = await Promise.all([
      db.select({ total: countExpression }).from(notifications).where(where),
      db
        .select({ unreadCount: countExpression })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false),
          ),
        ),
      db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalRow?.total || 0;
    const unreadCount = unreadRow?.unreadCount || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    sendSuccess(res, 200, "Notificaciones obtenidas", results, {
      page,
      limit,
      total,
      totalPages,
      unreadCount,
    });
  } catch (error) {
    sendError(res, 500, "Error al obtener notificaciones", error);
  }
};

export const markAsRead = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!updated) {
      sendError(res, 404, "Notificación no encontrada");
      return;
    }

    realtimeService.emitToUser(userId, "notification.updated", updated);

    sendSuccess(res, 200, "Notificación marcada como leída", updated);
  } catch (error) {
    sendError(res, 500, "Error al actualizar notificación", error);
  }
};

export const markAllAsRead = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    realtimeService.emitToUser(userId, "notification.updated.bulk", {
      userId,
      isRead: true,
    });

    sendSuccess(res, 200, "Todas las notificaciones marcadas como leídas");
  } catch (error) {
    sendError(res, 500, "Error al actualizar notificaciones", error);
  }
};

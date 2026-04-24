import { and, desc, eq } from "drizzle-orm";
import { Response } from "express";
import { db } from "../../config/db.js";
import { notifications } from "../../db/schema/notifications.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import { realtimeService } from "../../realtime/websocket.service.js";
import { sendError, sendSuccess } from "../../utils/response.util.js";

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const results = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50); // Últimas 50 notificaciones

    sendSuccess(res, 200, "Notificaciones obtenidas", results);
  } catch (error) {
    sendError(res, 500, "Error al obtener notificaciones", error);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
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

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
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

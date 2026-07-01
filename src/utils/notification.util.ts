import { createChildLogger } from "../config/logger.js";
import { db } from "../config/db.js";
import { notifications } from "../db/schema/notifications.js";
import { realtimeService } from "../realtime/websocket.service.js";

const logger = createChildLogger("notification");

export interface NotificationParams {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: unknown;
}

/**
 * Registra y envía una notificación a un usuario
 */
export const sendNotification = async (params: NotificationParams) => {
  try {
    // 1. Guardar en base de datos para persistencia en el App
    const [newNotification] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        title: params.title,
        body: params.body,
        type: params.type,
        data: params.data ? JSON.stringify(params.data) : null,
      })
      .returning();

    if (newNotification) {
      realtimeService.emitNotification(newNotification);
    }

    // 2. TODO: Implementar envío Push real (FCM / Firebase / Supabase)
    // console.log(`[PUSH SENT] A: ${params.userId} - Título: ${params.title}`);

    return newNotification;
  } catch (error) {
    logger.error({ err: error }, "Error enviando notificación");
    // No lanzamos error para no romper el flujo principal
  }
};

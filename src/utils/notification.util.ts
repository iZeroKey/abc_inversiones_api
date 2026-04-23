import { db } from "../config/db.js";
import { notifications } from "../db/schema/notifications.js";

export interface NotificationParams {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: any;
}

/**
 * Registra y envía una notificación a un usuario
 */
export const sendNotification = async (params: NotificationParams) => {
  try {
    // 1. Guardar en base de datos para persistencia en el App
    const [newNotification] = await db.insert(notifications).values({
      userId: params.userId,
      title: params.title,
      body: params.body,
      type: params.type,
      data: params.data ? JSON.stringify(params.data) : null,
    }).returning();

    // 2. TODO: Implementar envío Push real (FCM / Firebase / Supabase)
    // console.log(`[PUSH SENT] A: ${params.userId} - Título: ${params.title}`);

    return newNotification;
  } catch (error) {
    console.error("[Notification Error]:", error);
    // No lanzamos error para no romper el flujo principal
  }
};

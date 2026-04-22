import { desc, eq } from "drizzle-orm";
import { Request, Response } from "express";
import { db } from "../../config/db.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { accessRequests } from "../../db/schema/access-requests.js";
import { users } from "../../db/schema/users.js";
import { AuthRequest } from "../../middleware/auth.middleware.js";
import {
  formatZodError,
  sendError,
  sendSuccess,
} from "../../utils/response.util.js";
import {
  createAccessRequestSchema,
  updateRequestStatusSchema,
} from "./access-requests.schema.js";
import { logAudit } from "../../utils/audit.util.js";

export const createRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validation = createAccessRequestSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const [newRequest] = await db
      .insert(accessRequests)
      .values(validation.data)
      .returning();

    await logAudit({
      action: "SUBMIT_ACCESS_REQUEST",
      module: "ACCESS_REQUESTS",
      entityId: newRequest.id,
      newData: newRequest,
      req,
    });

    sendSuccess(res, 201, "Solicitud enviada correctamente", newRequest);
  } catch (error) {
    sendError(res, 500, "Error al crear la solicitud", error);
  }
};

export const getAllRequests = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const requests = await db
      .select()
      .from(accessRequests)
      .orderBy(desc(accessRequests.createdAt));

    sendSuccess(res, 200, "Solicitudes obtenidas", requests);
  } catch (error) {
    sendError(res, 500, "Error al obtener solicitudes", error);
  }
};

export const getRequestById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [request] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, id))
      .limit(1);

    if (!request) {
      sendError(res, 404, "Solicitud no encontrada");
      return;
    }

    sendSuccess(res, 200, "Solicitud obtenida", request);
  } catch (error) {
    sendError(res, 500, "Error al obtener la solicitud", error);
  }
};

export const updateStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validation = updateRequestStatusSchema.safeParse(req.body);

    if (!validation.success) {
      sendError(res, 400, "Datos inválidos", formatZodError(validation.error));
      return;
    }

    const { status, observation, initialPassword } = validation.data;

    const [accessRequest] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, id))
      .limit(1);

    if (!accessRequest) {
      sendError(res, 404, "Solicitud no encontrada");
      return;
    }

    if (accessRequest.status === "approved") {
      sendError(res, 400, "Esta solicitud ya ha sido aprobada");
      return;
    }

    if (status === "approved") {
      const password = initialPassword || "ABC123password";

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: accessRequest.email,
          password: password,
          email_confirm: true,
          phone: accessRequest.phone,
          phone_confirm: true,
        });

      if (authError) {
        sendError(
          res,
          400,
          "Error al crear usuario en Auth",
          authError.message,
        );
        return;
      }

      await db.insert(users).values({
        id: authData.user!.id,
        email: accessRequest.email,
        firstName: accessRequest.firstName,
        lastName: accessRequest.lastName,
        phone: accessRequest.phone,
        role: accessRequest.roleRequested,
      });

      await logAudit({
        userId: req.user!.id,
        action: "APPROVE_ACCESS_REQUEST_USER_CREATED",
        module: "ACCESS_REQUESTS",
        entityId: authData.user!.id,
        req,
      });
    }

    const [updatedRequest] = await db
      .update(accessRequests)
      .set({
        status,
        observation,
        updatedAt: new Date(),
      })
      .where(eq(accessRequests.id, id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      action: `PROCESS_ACCESS_REQUEST_${status.toUpperCase()}`,
      module: "ACCESS_REQUESTS",
      entityId: id,
      newData: { status },
      req,
    });

    sendSuccess(res, 200, `Solicitud marcada como ${status}`, updatedRequest);
  } catch (error) {
    sendError(res, 500, "Error al actualizar la solicitud", error);
  }
};

import { Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { resolveAuthenticatedUser } from "../middleware/auth.helpers.js";

type RealtimeMessage = {
  type: string;
  data?: unknown;
  timestamp: string;
};

type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "ping" }
  | { type: string; data?: unknown };

type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  data: string | null;
  createdAt: Date;
};

type SocketUser = {
  userId: string;
  role: "admin" | "client" | "investor";
  isOwner: boolean;
};

const parseMessage = (data: RawData): ClientMessage | null => {
  const raw = typeof data === "string" ? data : data.toString("utf8");

  try {
    return JSON.parse(raw) as ClientMessage;
  } catch {
    return null;
  }
};

const parseNotificationData = (data: string | null): unknown => {
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const serializeNotification = (notification: NotificationRecord) => ({
  id: notification.id,
  userId: notification.userId,
  title: notification.title,
  body: notification.body,
  type: notification.type,
  isRead: notification.isRead,
  data: parseNotificationData(notification.data),
  createdAt: notification.createdAt.toISOString(),
});

class RealtimeService {
  private wss: WebSocketServer | null = null;
  private readonly socketsByUser = new Map<string, Set<WebSocket>>();
  private readonly userBySocket = new Map<WebSocket, string>();
  private readonly socketUsers = new Map<WebSocket, SocketUser>();

  attach(server: Server): void {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  close(): void {
    for (const socket of this.userBySocket.keys()) {
      try {
        socket.close(1001, "Servidor detenido");
      } catch {
        // Ignoramos cierres fallidos al apagar.
      }
    }

    this.userBySocket.clear();
    this.socketsByUser.clear();
    this.socketUsers.clear();

    if (!this.wss) {
      return;
    }

    this.wss.close();
    this.wss = null;
  }

  emitToUser(userId: string, type: string, data?: unknown): void {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets?.size) {
      return;
    }

    const message = this.createMessage(type, data);
    for (const socket of sockets) {
      this.safeSend(socket, message);
    }
  }

  emitToAll(type: string, data?: unknown): void {
    const message = this.createMessage(type, data);
    for (const socket of this.userBySocket.keys()) {
      this.safeSend(socket, message);
    }
  }

  emitToAudience(
    audience: {
      userIds?: Array<string | null | undefined>;
      includeAdmins?: boolean;
    },
    type: string,
    data?: unknown,
  ): void {
    const message = this.createMessage(type, data);
    const sentSockets = new Set<WebSocket>();

    const sendOnce = (socket: WebSocket) => {
      if (sentSockets.has(socket)) {
        return;
      }

      sentSockets.add(socket);
      this.safeSend(socket, message);
    };

    if (audience.includeAdmins) {
      for (const [socket, socketUser] of this.socketUsers.entries()) {
        if (socketUser.role === "admin" || socketUser.isOwner) {
          sendOnce(socket);
        }
      }
    }

    for (const userId of audience.userIds ?? []) {
      if (!userId) {
        continue;
      }

      const sockets = this.socketsByUser.get(userId);
      for (const socket of sockets ?? []) {
        sendOnce(socket);
      }
    }
  }

  emitNotification(notification: NotificationRecord): void {
    this.emitToUser(
      notification.userId,
      "notification.created",
      serializeNotification(notification),
    );
  }

  private handleConnection(socket: WebSocket): void {
    this.safeSend(socket, {
      type: "connected",
      data: {
        authenticated: false,
        nextStep: "send auth message with your Supabase access token",
      },
      timestamp: new Date().toISOString(),
    });

    const authTimeout = setTimeout(() => {
      if (!this.userBySocket.has(socket)) {
        this.safeSend(socket, {
          type: "auth.required",
          data: { message: "Se requiere autenticación" },
          timestamp: new Date().toISOString(),
        });
        socket.close(4001, "Authentication required");
      }
    }, 15000);

    socket.on("message", async (data) => {
      const message = parseMessage(data);
      if (!message) {
        this.safeSend(socket, {
          type: "error",
          data: { message: "Mensaje inválido" },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (message.type === "auth") {
        const authMessage = message as Extract<ClientMessage, { type: "auth" }>;
        await this.authenticateSocket(socket, authMessage.token, authTimeout);
        return;
      }

      const userId = this.userBySocket.get(socket);
      if (!userId) {
        this.safeSend(socket, {
          type: "error",
          data: { message: "Primero debes autenticarte" },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (message.type === "ping") {
        this.safeSend(socket, {
          type: "pong",
          data: { userId },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      this.safeSend(socket, {
        type: "error",
        data: { message: `Tipo de mensaje no soportado: ${message.type}` },
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("close", () => {
      clearTimeout(authTimeout);
      this.detachSocket(socket);
    });

    socket.on("error", () => {
      clearTimeout(authTimeout);
      this.detachSocket(socket);
    });
  }

  private async authenticateSocket(
    socket: WebSocket,
    token: string,
    authTimeout: ReturnType<typeof setTimeout>,
  ): Promise<void> {
    let authResult: Awaited<ReturnType<typeof resolveAuthenticatedUser>>;
    try {
      authResult = await resolveAuthenticatedUser(token);
    } catch {
      this.safeSend(socket, {
        type: "auth.error",
        data: { message: "No se pudo validar la autenticación" },
        timestamp: new Date().toISOString(),
      });
      socket.close(1011, "Authentication service unavailable");
      return;
    }

    if (!authResult.user) {
      this.safeSend(socket, {
        type: "auth.error",
        data: { message: authResult.message },
        timestamp: new Date().toISOString(),
      });
      socket.close(4003, authResult.message);
      return;
    }

    clearTimeout(authTimeout);
    this.detachSocket(socket);

    this.userBySocket.set(socket, authResult.user.id);
    this.socketUsers.set(socket, {
      userId: authResult.user.id,
      role: authResult.user.role,
      isOwner: authResult.user.isOwner,
    });

    const sockets =
      this.socketsByUser.get(authResult.user.id) ?? new Set<WebSocket>();
    sockets.add(socket);
    this.socketsByUser.set(authResult.user.id, sockets);

    this.safeSend(socket, {
      type: "auth.ok",
      data: {
        userId: authResult.user.id,
        role: authResult.user.role,
        channels: ["notifications", "loans", "payments", "vouchers"],
      },
      timestamp: new Date().toISOString(),
    });
  }

  private detachSocket(socket: WebSocket): void {
    const userId = this.userBySocket.get(socket);
    if (!userId) {
      return;
    }

    const sockets = this.socketsByUser.get(userId);
    sockets?.delete(socket);

    if (sockets && sockets.size === 0) {
      this.socketsByUser.delete(userId);
    }

    this.userBySocket.delete(socket);
    this.socketUsers.delete(socket);
  }

  private createMessage(type: string, data?: unknown): RealtimeMessage {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private safeSend(socket: WebSocket, payload: RealtimeMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      this.detachSocket(socket);
      return;
    }

    try {
      socket.send(JSON.stringify(payload));
    } catch {
      this.detachSocket(socket);
    }
  }
}

export const realtimeService = new RealtimeService();

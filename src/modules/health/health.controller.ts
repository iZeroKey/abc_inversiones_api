import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/response.util.js";

/**
 * Health check con métricas de memoria y uptime.
 * Útil para monitorear presión de memoria en Cloud Run.
 */
export const getHealth = (_request: Request, response: Response): void => {
  const mem = process.memoryUsage();

  sendSuccess(response, 200, "Operación exitosa", {
    status: "ok",
    service: "abc-inversiones-api",
    uptime: {
      seconds: Math.floor(process.uptime()),
      formatted: formatUptime(process.uptime()),
    },
    memory: {
      rss: formatBytes(mem.rss),
      heapTotal: formatBytes(mem.heapTotal),
      heapUsed: formatBytes(mem.heapUsed),
      external: formatBytes(mem.external),
      arrayBuffers: formatBytes(mem.arrayBuffers),
      /** Porcentaje de heap utilizado (alto = posible presión de GC). */
      heapUsagePercent: `${((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)}%`,
    },
    node: process.version,
    pid: process.pid,
  });
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
};

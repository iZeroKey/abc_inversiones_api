import busboy from "busboy";
import { randomUUID } from "crypto";
import { NextFunction, Response } from "express";
import path from "path";
import { PassThrough, Readable } from "stream";
import { AuthRequest } from "./auth.middleware.js";

// ────────────────────────────────────────────────────────────────────────────
// Constantes de configuración
// ────────────────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const OCR_MAX_FILE_SIZE = 1.5 * 1024 * 1024;   // 1.5 MB
const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024;   // 2 MB

// ────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de un archivo parseado en modo "buffer" (OCR / fallback).
 * Compatible con la interfaz que multer exponía vía `req.file`.
 */
export interface ParsedFileBuffer {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Resultado de un archivo parseado en modo "stream".
 * El stream se consume directamente para hacer pipe a Storage.
 */
export interface ParsedFileStream {
  fieldname: string;
  originalname: string;
  mimetype: string;
  stream: Readable;
  /** Nombre de archivo destino ya generado (UUID + extensión). */
  generatedName: string;
}

/**
 * Datos resultantes del parseo de un multipart/form-data.
 * Contiene los campos de texto y opcionalmente un archivo (buffer o stream).
 */
export interface StreamParsedData {
  fields: Record<string, string>;
  file: ParsedFileBuffer | null;
  fileStream: ParsedFileStream | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Tipo augment de Express Request
// ────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Datos parseados del multipart vía streaming (busboy). */
      streamParsed?: StreamParsedData;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Middleware factory
// ────────────────────────────────────────────────────────────────────────────

interface StreamUploadOptions {
  /** Nombre del campo de archivo esperado (default: "evidence"). */
  fieldName?: string;
  /** Tamaño máximo del archivo en bytes. */
  maxFileSize?: number;
  /**
   * Modo de procesamiento:
   * - "buffer": Acumula el archivo en memoria (para OCR / procesamiento local).
   *             Llama next() cuando TODO el parseo termina (fields + file).
   * - "stream": Expone un ReadableStream para pipe directo a Storage.
   *             Llama next() cuando los fields están listos y el file stream
   *             está disponible (pero aún no consumido).
   */
  mode: "buffer" | "stream";
}

/**
 * Middleware de upload por streaming con busboy.
 *
 * Reemplaza a multer para los endpoints de vouchers.
 * En modo "stream", los bytes fluyen sin acumularse en RAM.
 * En modo "buffer", acumula para APIs que requieren el archivo completo (OCR).
 *
 * Parsea los campos de texto inmediatamente conforme llegan,
 * permitiendo que la lógica de negocio empiece a validar antes de que
 * termine la subida del archivo.
 */
export const streamUpload = (options: StreamUploadOptions) => {
  const {
    fieldName = "evidence",
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    mode,
  } = options;

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const contentType = req.headers["content-type"] || "";

    // Si no es multipart, pasar directamente (puede ser JSON-only).
    if (!contentType.includes("multipart/form-data")) {
      req.streamParsed = { fields: {}, file: null, fileStream: null };
      next();
      return;
    }

    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 1,               // Solo un archivo
        fileSize: maxFileSize,
        fields: 20,             // Campos de texto razonables
      },
    });

    const fields: Record<string, string> = {};
    let fileTruncated = false;
    let nextCalled = false;
    let responded = false;

    // Resultado que se irá llenando
    const parsed: StreamParsedData = {
      fields,
      file: null,
      fileStream: null,
    };

    req.streamParsed = parsed;

    const callNext = () => {
      if (!nextCalled && !responded) {
        nextCalled = true;
        next();
      }
    };

    const sendErrorResponse = (status: number, message: string) => {
      if (!responded && !nextCalled) {
        responded = true;
        res.status(status).json({ success: false, message });
      }
    };

    // ── Campos de texto ──────────────────────────────────────────────
    bb.on("field", (name: string, value: string) => {
      fields[name] = value;
    });

    // ── Archivo ──────────────────────────────────────────────────────
    bb.on("file", (name: string, stream: Readable, info: busboy.FileInfo) => {
      const { filename, mimeType } = info;

      // Ignorar campos que no son el esperado
      if (name !== fieldName) {
        stream.resume(); // Drenar el stream para que busboy continúe
        return;
      }

      // Validar MIME type antes de consumir bytes
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        stream.resume();
        sendErrorResponse(400, "Solo se permiten imágenes JPEG, PNG o WebP");
        return;
      }

      // Evento: archivo excedió el límite
      stream.on("limit", () => {
        fileTruncated = true;
      });

      if (mode === "buffer") {
        // ── Modo Buffer: acumular para OCR ──
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          if (fileTruncated) return; // Se manejará en bb.on("finish")

          parsed.file = {
            fieldname: name,
            originalname: filename,
            mimetype: mimeType,
            buffer: Buffer.concat(chunks),
            size: chunks.reduce((acc, c) => acc + c.length, 0),
          };
        });
      } else {
        // ── Modo Stream: exponer para pipe directo ──
        // Usamos un PassThrough para que el stream no se pierda mientras
        // esperamos a que el controller lo consuma. Busboy emite datos
        // desde que detecta el archivo — el PassThrough los buferea brevemente.
        const passThrough = new PassThrough();
        stream.pipe(passThrough);

        const ext = path.extname(filename) || ".jpg";
        const generatedName = `${randomUUID()}${ext}`;

        parsed.fileStream = {
          fieldname: name,
          originalname: filename,
          mimetype: mimeType,
          stream: passThrough,
          generatedName,
        };
      }
    });

    // ── Finalización ─────────────────────────────────────────────────
    bb.on("finish", () => {
      if (fileTruncated) {
        const limitMB = (maxFileSize / (1024 * 1024)).toFixed(1);
        sendErrorResponse(413, `El archivo excede el límite de ${limitMB}MB`);
        return;
      }

      // En AMBOS modos, llamar next() cuando busboy termina de parsear.
      // - Buffer: el archivo ya está completo en parsed.file.
      // - Stream: los fields están listos y fileStream tiene un PassThrough
      //   que puede contener datos buferados + continuará recibiendo si hay más.
      //
      // Nota: Para stream mode, esto significa que el stream podría ya haber
      // terminado para archivos pequeños, pero para archivos grandes el
      // PassThrough seguirá emitiendo datos mientras el controller lo consume.
      callNext();
    });

    bb.on("error", (err: Error) => {
      sendErrorResponse(400, `Error procesando el formulario: ${err.message}`);
    });

    // ── Iniciar parseo: pipear request a busboy ──
    req.pipe(bb);
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Presets reutilizables
// ────────────────────────────────────────────────────────────────────────────

/** Upload en streaming para /vouchers (pipe directo a Storage). */
export const streamVoucherUpload = streamUpload({
  fieldName: "evidence",
  maxFileSize: DEFAULT_MAX_FILE_SIZE,
  mode: "stream",
});

/** Upload en buffer para /analyze (OCR necesita imagen completa). */
export const bufferOcrUpload = streamUpload({
  fieldName: "evidence",
  maxFileSize: OCR_MAX_FILE_SIZE,
  mode: "buffer",
});

/** Upload en buffer para avatar (necesita imagen completa para reemplazo seguro). */
export const bufferAvatarUpload = streamUpload({
  fieldName: "avatar",
  maxFileSize: AVATAR_MAX_FILE_SIZE,
  mode: "buffer",
});

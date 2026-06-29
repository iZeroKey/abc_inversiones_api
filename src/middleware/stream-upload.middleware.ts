import busboy from "busboy";
import { randomUUID } from "crypto";
import { NextFunction, Response } from "express";
import path from "path";
import { PassThrough, Readable } from "stream";
import { supabaseAdmin } from "../config/supabase.js";
import { AuthRequest } from "./auth.middleware.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const OCR_MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB
const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export interface ParsedFileBuffer {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface DirectFileStream {
  fieldname: string;
  originalname: string;
  mimetype: string;
  generatedName: string;
  uploadPromise: Promise<string>;
}

export interface StreamParsedData {
  fields: Record<string, string>;
  file: ParsedFileBuffer | null;
  fileStream: DirectFileStream | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      streamParsed?: StreamParsedData;
    }
  }
}

interface StreamUploadOptions {
  fieldName?: string;
  maxFileSize?: number;
  /** "buffer" = collect chunks in memory, "direct-stream" = pipe directly to Supabase */
  mode: "buffer" | "direct-stream";
  /** Used in direct-stream mode to know which bucket to upload to */
  bucket: "vouchers" | "avatars";
}

const STORAGE_REF_PREFIX = "storage://";

const createStorageReference = (bucket: string, objectPath: string): string => {
  return `${STORAGE_REF_PREFIX}${bucket}/${objectPath}`;
};

export const streamUpload = (options: StreamUploadOptions) => {
  const {
    fieldName = "evidence",
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    mode,
    bucket,
  } = options;

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      req.streamParsed = { fields: {}, file: null, fileStream: null };
      next();
      return;
    }

    const bb = busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: maxFileSize,
        fields: 20,
      },
    });

    const fields: Record<string, string> = {};
    let fileTruncated = false;
    let nextCalled = false;
    let responded = false;
    let uploadError: Error | null = null;

    const parsed: StreamParsedData = {
      fields,
      file: null,
      fileStream: null,
    };

    req.streamParsed = parsed;

    const callNext = () => {
      if (!nextCalled && !responded) {
        nextCalled = true;
        if (uploadError) {
          responded = true;
          res
            .status(500)
            .json({ success: false, message: uploadError.message });
          return;
        }
        next();
      }
    };

    const sendErrorResponse = (status: number, message: string) => {
      if (!responded && !nextCalled) {
        responded = true;
        res.status(status).json({ success: false, message });
      }
    };

    bb.on("field", (name: string, value: string) => {
      fields[name] = value;
    });

    bb.on("file", (name: string, stream: Readable, info: busboy.FileInfo) => {
      const { filename, mimeType } = info;

      if (name !== fieldName) {
        stream.resume();
        return;
      }

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        stream.resume();
        sendErrorResponse(400, "Solo se permiten imágenes JPEG, PNG o WebP");
        return;
      }

      stream.on("limit", () => {
        fileTruncated = true;
      });

      if (mode === "buffer") {
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          if (fileTruncated) return;

          parsed.file = {
            fieldname: name,
            originalname: filename,
            mimetype: mimeType,
            buffer: Buffer.concat(chunks),
            size: chunks.reduce((acc, c) => acc + c.length, 0),
          };
        });
      } else {
        const ext = path.extname(filename) || ".jpg";
        const generatedName = `${randomUUID()}${ext}`;
        const tempPath = `temp/${generatedName}`;

        const passThrough = new PassThrough();

        const uploadPromise = supabaseAdmin.storage
          .from(bucket)
          .upload(tempPath, passThrough, {
            contentType: mimeType,
            upsert: false,
          })
          .then(({ data, error }) => {
            if (error) throw new Error(error.message);
            return createStorageReference(bucket, data.path);
          })
          .catch((err: Error) => {
            uploadError = err;
            throw err;
          });

        stream.pipe(passThrough);

        stream.on("error", (err: Error) => {
          uploadError = err;
          passThrough.destroy(err);
        });

        parsed.fileStream = {
          fieldname: name,
          originalname: filename,
          mimetype: mimeType,
          generatedName,
          uploadPromise,
        };
      }
    });

    bb.on("finish", () => {
      if (fileTruncated) {
        const limitMB = (maxFileSize / (1024 * 1024)).toFixed(1);
        sendErrorResponse(413, `El archivo excede el límite de ${limitMB}MB`);
        return;
      }

      callNext();
    });

    bb.on("error", (err: Error) => {
      uploadError = err;
      sendErrorResponse(400, `Error procesando el formulario: ${err.message}`);
    });

    req.pipe(bb);
  };
};

export const streamVoucherUpload = streamUpload({
  fieldName: "evidence",
  maxFileSize: DEFAULT_MAX_FILE_SIZE,
  mode: "direct-stream",
  bucket: "vouchers",
});

export const bufferOcrUpload = streamUpload({
  fieldName: "evidence",
  maxFileSize: OCR_MAX_FILE_SIZE,
  mode: "buffer",
  bucket: "vouchers",
});

export const streamAvatarUpload = streamUpload({
  fieldName: "avatar",
  maxFileSize: AVATAR_MAX_FILE_SIZE,
  mode: "direct-stream",
  bucket: "avatars",
});

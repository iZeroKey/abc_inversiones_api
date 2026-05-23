import { randomUUID } from "crypto";
import path from "path";
import { Readable } from "stream";
import { env } from "../config/env.js";
import { createChildLogger } from "../config/logger.js";
import { supabaseAdmin } from "../config/supabase.js";

const logger = createChildLogger("storage");
const STORAGE_REF_PREFIX = "storage://";

interface UploadedStorageObject {
  path: string;
  reference: string;
}

const createStorageReference = (bucket: string, objectPath: string): string => {
  return `${STORAGE_REF_PREFIX}${bucket}/${objectPath}`;
};

const parseStorageReference = (
  value: string,
): { bucket: string; path: string } | null => {
  if (!value.startsWith(STORAGE_REF_PREFIX)) {
    return null;
  }

  const rawPath = value.slice(STORAGE_REF_PREFIX.length);
  const slashIndex = rawPath.indexOf("/");

  if (slashIndex <= 0 || slashIndex === rawPath.length - 1) {
    return null;
  }

  return {
    bucket: rawPath.slice(0, slashIndex),
    path: rawPath.slice(slashIndex + 1),
  };
};

export const uploadFile = async (
  bucket: string,
  folder: string,
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> => {
  const uploaded = await uploadPrivateFile(
    bucket,
    folder,
    buffer,
    originalName,
    contentType,
  );
  return uploaded.reference;
};

export const uploadPrivateFile = async (
  bucket: string,
  folder: string,
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<UploadedStorageObject> => {
  const ext = path.extname(originalName) || ".jpg";
  const fileName = `${randomUUID()}${ext}`;
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Error subiendo archivo a Storage: ${error.message}`);
  }

  return {
    path: data.path,
    reference: createStorageReference(bucket, data.path),
  };
};

export const uploadAvatar = async (
  userId: string,
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> => {
  const ext = path.extname(originalName) || ".jpg";
  const tempPath = `${userId}/avatar_tmp_${randomUUID()}${ext}`;
  const finalPath = `${userId}/avatar${ext}`;
  const bucket = "avatars";

  const { error: tempError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(tempPath, buffer, {
      contentType,
      upsert: false,
    });

  if (tempError) {
    throw new Error(`Error subiendo avatar temporal: ${tempError.message}`);
  }

  try {
    await supabaseAdmin.storage.from(bucket).remove([finalPath]);

    const { data, error: finalError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(finalPath, buffer, {
        contentType,
        upsert: true,
      });

    if (finalError) {
      logger.error(
        { userId, finalPath, error: finalError.message },
        "Error subiendo avatar final, temporal preservada",
      );
      throw new Error(`Error subiendo avatar: ${finalError.message}`);
    }

    await supabaseAdmin.storage.from(bucket).remove([tempPath]);

    return createStorageReference(bucket, data.path);
  } catch (error) {
    await supabaseAdmin.storage
      .from(bucket)
      .remove([tempPath])
      .catch(() => {});
    throw error;
  }
};

export const deleteFile = async (
  bucket: string,
  filePath: string,
): Promise<void> => {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([filePath]);

  if (error) {
    console.error(`[Storage Delete Error]: ${error.message}`);
  }
};

export const deleteStorageReference = async (
  value: string | null | undefined,
): Promise<boolean> => {
  if (!value) {
    return false;
  }

  const parsed = parseStorageReference(value);
  if (!parsed) {
    return false;
  }

  const { error } = await supabaseAdmin.storage
    .from(parsed.bucket)
    .remove([parsed.path]);

  if (error) {
    throw new Error(`Error eliminando archivo de Storage: ${error.message}`);
  }

  return true;
};

export const resolveFileUrl = async (
  value: string | null | undefined,
  expiresIn = env.STORAGE_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> => {
  if (!value) {
    return null;
  }

  const parsed = parseStorageReference(value);
  if (!parsed) {
    return value;
  }

  const { data, error } = await supabaseAdmin.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);

  if (error) {
    throw new Error(`Error generando URL firmada: ${error.message}`);
  }

  return data.signedUrl;
};

export const uploadFileStream = async (
  bucket: string,
  folder: string,
  file: Readable | Buffer,
  fileName: string,
  contentType: string,
): Promise<string> => {
  const filePath = `${folder}/${fileName}`;

  let buffer: Buffer;
  if (Buffer.isBuffer(file)) {
    buffer = file;
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  }

  logger.debug(
    { bucket, filePath, sizeKB: (buffer.length / 1024).toFixed(1) },
    "Subiendo archivo a Storage",
  );

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Error subiendo archivo a Storage: ${error.message}`);
  }

  logger.debug({ bucket, filePath: data.path }, "Upload completado");

  return createStorageReference(bucket, data.path);
};

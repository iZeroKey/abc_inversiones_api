import { supabaseAdmin } from "../config/supabase.js";
import { randomUUID } from "crypto";
import path from "path";
import { env } from "../config/env.js";

const STORAGE_REF_PREFIX = "storage://";

interface UploadedStorageObject {
  path: string;
  reference: string;
}

const createStorageReference = (bucket: string, objectPath: string): string => {
  return `${STORAGE_REF_PREFIX}${bucket}/${objectPath}`;
};

const parseStorageReference = (value: string): { bucket: string; path: string } | null => {
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

/**
 * Sube un archivo al Storage de Supabase.
 * Usa el cliente administrativo (service_role) para garantizar acceso.
 * 
 * @param bucket  Nombre del bucket (ej: "vouchers", "avatars")
 * @param folder  Subcarpeta organizacional (ej: userId, loanId)
 * @param buffer  Contenido del archivo en buffer
 * @param originalName  Nombre original del archivo (para extraer extensión)
 * @param contentType  MIME type del archivo
 * @returns URL pública del archivo subido
 */
export const uploadFile = async (
  bucket: string,
  folder: string,
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> => {
  const uploaded = await uploadPrivateFile(bucket, folder, buffer, originalName, contentType);
  return uploaded.reference;
};

/**
 * Sube un archivo a un bucket privado y devuelve una referencia interna
 * que luego puede resolverse a una signed URL desde el backend.
 */
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

/**
 * Sube un avatar (upsert) — sobrescribe si ya existe.
 * Usa un nombre fijo "avatar" para que se sobrescriba siempre.
 */
export const uploadAvatar = async (
  userId: string,
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> => {
  const ext = path.extname(originalName) || ".jpg";
  const filePath = `${userId}/avatar${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from("avatars")
    .upload(filePath, buffer, {
      contentType,
      upsert: true, // Sobrescribir avatar anterior
    });

  if (error) {
    throw new Error(`Error subiendo avatar: ${error.message}`);
  }

  return createStorageReference("avatars", data.path);
};

/**
 * Elimina un archivo del Storage de Supabase.
 */
export const deleteFile = async (bucket: string, filePath: string): Promise<void> => {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    console.error(`[Storage Delete Error]: ${error.message}`);
  }
};

/**
 * Resuelve una referencia interna de Storage a una URL utilizable por el cliente.
 * Si recibe una URL normal, la devuelve tal cual para mantener compatibilidad
 * con registros antiguos o valores externos.
 */
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

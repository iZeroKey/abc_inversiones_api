import { Readable } from "stream";
import { supabaseAdmin } from "../config/supabase.js";
import { randomUUID } from "crypto";
import path from "path";
import { env } from "../config/env.js";
import { createChildLogger } from "../config/logger.js";

const logger = createChildLogger("storage");
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
 * Sube un avatar con reemplazo seguro (atómico).
 *
 * Estrategia:
 * 1. Subir la nueva imagen a una ruta temporal ({userId}/avatar_tmp_{uuid}.{ext}).
 * 2. Solo si la subida temporal tiene éxito, eliminar el avatar anterior.
 * 3. Subir la imagen final a la ruta canónica ({userId}/avatar.{ext}).
 * 4. Eliminar la copia temporal.
 *
 * Esto asegura que el usuario NUNCA se quede sin avatar:
 * - Si la subida temporal falla → el avatar anterior se preserva.
 * - Si la subida final falla → el avatar temporal sigue disponible.
 */
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

  // 1. Subir a ruta temporal
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
    // 2. Eliminar avatar anterior (si existe)
    await supabaseAdmin.storage.from(bucket).remove([finalPath]);

    // 3. Subir a la ruta canónica (definitiva)
    const { data, error: finalError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(finalPath, buffer, {
        contentType,
        upsert: true,
      });

    if (finalError) {
      // Si falla la subida final, la temporal sigue existiendo
      // y se puede usar como referencia de emergencia.
      logger.error({ userId, finalPath, error: finalError.message }, "Error subiendo avatar final, temporal preservada");
      throw new Error(`Error subiendo avatar: ${finalError.message}`);
    }

    // 4. Limpiar la copia temporal
    await supabaseAdmin.storage.from(bucket).remove([tempPath]);

    return createStorageReference(bucket, data.path);
  } catch (error) {
    // Cleanup: intentar eliminar la temporal si algo falla inesperadamente
    // pero NO lanzar error de cleanup para no ocultar el error original.
    await supabaseAdmin.storage.from(bucket).remove([tempPath]).catch(() => {});
    throw error;
  }
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
 * Elimina una referencia interna de Storage (storage://bucket/path).
 * Devuelve false cuando el valor no es una referencia interna, para mantener
 * compatibilidad con URLs antiguas o externas que no se pueden borrar desde Storage.
 */
export const deleteStorageReference = async (value: string | null | undefined): Promise<boolean> => {
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

// ────────────────────────────────────────────────────────────────────────────
// Streaming Upload (Pass-Through desde busboy a Supabase Storage)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sube un archivo a Supabase Storage desde un stream (vía busboy).
 *
 * Estrategia actual:
 * 1. El middleware busboy parsea los campos de texto Y el stream del archivo
 *    concurrentemente conforme llegan del cliente.
 * 2. Mientras el archivo fluye, el controller ya está validando los campos
 *    (duplicados, permisos, etc.) en paralelo.
 * 3. El archivo se recolecta en un buffer breve y se sube al SDK de Supabase.
 *
 * Beneficios vs multer:
 * - La validación de negocio ocurre DURANTE la subida del archivo, no después.
 * - Si la validación falla (operationId duplicado, préstamo inactivo, etc.),
 *   la subida se aborta antes de completarse, ahorrando ancho de banda.
 * - El proxy Cloudflare mantiene actividad constante (bytes de request + 
 *   procesamiento concurrente), reduciendo el riesgo de timeout.
 *
 * @param bucket       Nombre del bucket (ej: "vouchers")
 * @param folder       Subcarpeta organizacional (ej: loanId)
 * @param stream       ReadableStream de Node.js con los bytes del archivo
 * @param fileName     Nombre de destino del archivo (ya generado con UUID)
 * @param contentType  MIME type del archivo
 * @returns Referencia interna al archivo subido (storage://bucket/path)
 */
export const uploadFileStream = async (
  bucket: string,
  folder: string,
  stream: Readable,
  fileName: string,
  contentType: string,
): Promise<string> => {
  const filePath = `${folder}/${fileName}`;

  logger.debug({ bucket, filePath }, "Streaming upload: recolectando stream");

  // Recolectar el stream en un buffer.
  // El stream viene del PassThrough de busboy — puede contener datos
  // ya bufeados (archivos pequeños) o seguir recibiendo datos (archivos grandes).
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);
  logger.debug({ bucket, filePath, sizeKB: (buffer.length / 1024).toFixed(1) }, "Stream recolectado, subiendo a Storage");

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Error subiendo archivo a Storage: ${error.message}`);
  }

  logger.debug({ bucket, filePath: data.path }, "Streaming upload completado");

  return createStorageReference(bucket, data.path);
};

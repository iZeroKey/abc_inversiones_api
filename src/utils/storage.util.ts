import { supabaseAdmin } from "../config/supabase.js";
import { randomUUID } from "crypto";
import path from "path";

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

  // Obtener URL pública
  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
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

  const { data: urlData } = supabaseAdmin.storage
    .from("avatars")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
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

import { randomUUID } from "crypto";
import path from "path";
import { Readable } from "stream";
import { env } from "../config/env.js";
import { createChildLogger } from "../config/logger.js";
import { supabaseAdmin } from "../config/supabase.js";

const logger = createChildLogger("storage");
export const STORAGE_REF_PREFIX = "storage://";

interface UploadedStorageObject {
  path: string;
  reference: string;
}

const createStorageReference = (bucket: string, objectPath: string): string => {
  return `${STORAGE_REF_PREFIX}${bucket}/${objectPath}`;
};

export const parseStorageReference = (
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

export const finalizeAvatarUpload = async (
  userId: string,
  tempStorageRef: string,
): Promise<string> => {
  const parsed = parseStorageReference(tempStorageRef);
  if (!parsed) {
    throw new Error("Referencia de storage inválida");
  }

  const ext = path.extname(parsed.path) || ".jpg";
  const finalPath = `${userId}/avatar${ext}`;
  const bucket = "avatars";

  await supabaseAdmin.storage.from(bucket).remove([finalPath]);

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .move(parsed.path, finalPath);

  if (error) {
    throw new Error(`Error moviendo avatar: ${error.message}`);
  }

  return createStorageReference(bucket, finalPath);
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

export const moveStorageFile = async (
  bucket: string,
  fromPath: string,
  toPath: string,
): Promise<string> => {
  const { error } = await supabaseAdmin.storage.from(bucket).move(fromPath, toPath);
  if (error) {
    throw new Error(`Error moviendo archivo de Storage: ${error.message}`);
  }
  return createStorageReference(bucket, toPath);
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

export async function attachSignedUrls<
  T extends { evidenceUrl?: string | null; avatarUrl?: string | null },
>(
  items: T[],
  urlField: "evidenceUrl" | "avatarUrl" = "evidenceUrl",
  bucket?: string,
  expiresIn = 3600,
): Promise<T[]> {
  const withStorage = items.filter((i) =>
    i[urlField]?.startsWith(STORAGE_REF_PREFIX),
  );
  if (withStorage.length === 0) return items;

  const paths = withStorage.map((i) => {
    const parsed = parseStorageReference(i[urlField]!);
    return parsed ? parsed.path : i[urlField]!.replace(STORAGE_REF_PREFIX, "");
  });

  const resolvedBucket = bucket ?? (urlField === "avatarUrl" ? "avatars" : "vouchers");
  
  const { data } = await supabaseAdmin.storage
    .from(resolvedBucket)
    .createSignedUrls(paths, expiresIn);
    
  const urlMap = new Map(data?.map((d) => [d.path, d.signedUrl]) ?? []);

  return items.map((item) => {
    if (!item[urlField]?.startsWith(STORAGE_REF_PREFIX)) return item;
    
    const parsed = parseStorageReference(item[urlField]!);
    const mapKey = parsed ? parsed.path : item[urlField]!.replace(STORAGE_REF_PREFIX, "");
    
    const resolved = urlMap.get(mapKey);
    return {
      ...item,
      [urlField]: resolved ?? item[urlField],
    };
  });
}

export const uploadFileStreamDirect = async (
  bucket: string,
  folder: string,
  stream: Readable,
  fileName: string,
  contentType: string,
): Promise<string> => {
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, stream, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Error subiendo archivo a Storage: ${error.message}`);
  }

  logger.debug({ bucket, filePath: data.path }, "Streaming upload completado");

  return createStorageReference(bucket, data.path);
};

export const uploadAvatarStream = async (
  userId: string,
  stream: Readable,
  originalName: string,
  contentType: string,
): Promise<string> => {
  const ext = path.extname(originalName) || ".jpg";
  const tempPath = `${userId}/avatar_tmp_${randomUUID()}${ext}`;
  const finalPath = `${userId}/avatar${ext}`;
  const bucket = "avatars";

  const { error: tempError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(tempPath, stream, {
      contentType,
      upsert: false,
    });

  if (tempError) {
    throw new Error(`Error subiendo avatar temporal: ${tempError.message}`);
  }

  try {
    await supabaseAdmin.storage.from(bucket).remove([finalPath]);

    const { error: finalError } = await supabaseAdmin.storage
      .from(bucket)
      .move(tempPath, finalPath);

    if (finalError) {
      logger.error(
        { userId, finalPath, error: finalError.message },
        "Error moviendo avatar, temporal preservada",
      );
      throw new Error(`Error moviendo avatar: ${finalError.message}`);
    }

    return createStorageReference(bucket, finalPath);
  } catch (error) {
    await supabaseAdmin.storage
      .from(bucket)
      .remove([tempPath])
      .catch(() => {});
    throw error;
  }
};

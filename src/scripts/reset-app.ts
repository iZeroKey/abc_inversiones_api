/**
 * Script temporal de reseteo completo de la app en Supabase.
 *
 * Elimina:
 * - tablas del esquema public relacionadas a la app;
 * - políticas de storage.objects creadas por este proyecto;
 * - objetos y buckets de Storage usados por la app;
 * - usuarios de Supabase Auth.
 *
 * Uso:
 *   pnpm app:reset --confirm
 *
 * Este script es destructivo y está pensado para pruebas de bootstrap.
 */
import "dotenv/config";
import { queryClient } from "../config/db.js";
import { supabaseAdmin } from "../config/supabase.js";

const hasConfirmFlag = process.argv.includes("--confirm");

const APP_BUCKETS = ["vouchers", "avatars"] as const;

const STORAGE_POLICIES = [
  "avatars_admin_all",
  "avatars_owner_self_all",
  "vouchers_admin_all",
  "vouchers_client_read",
  "vouchers_investor_read",
  "vouchers_client_manage_own",
] as const;

const APP_TABLES = [
  "notifications",
  "audit_logs",
  "payment_vouchers",
  "payments",
  "installments",
  "loans",
  "access_requests",
  "users",
] as const;

const APP_SEQUENCES = [
  "loan_public_code_seq",
  "client_public_code_seq",
  "investor_public_code_seq",
] as const;

const isBucketNotFoundError = (message?: string): boolean => {
  if (!message) {
    return false;
  }

  return message.toLowerCase().includes("bucket not found");
};

const deleteBucketObjects = async (bucketName: string): Promise<void> => {
  const stack: string[] = [""];
  const pathsToDelete: string[] = [];

  while (stack.length > 0) {
    const prefix = stack.pop()!;
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .list(prefix, {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      throw new Error(
        `Error listando objetos de ${bucketName}: ${error.message}`,
      );
    }

    for (const item of data ?? []) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        stack.push(itemPath);
      } else {
        pathsToDelete.push(itemPath);
      }
    }
  }

  for (let i = 0; i < pathsToDelete.length; i += 100) {
    const chunk = pathsToDelete.slice(i, i + 100);
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .remove(chunk);

    if (error) {
      throw new Error(
        `Error eliminando objetos de ${bucketName}: ${error.message}`,
      );
    }
  }
};

async function resetApp(): Promise<void> {
  if (!hasConfirmFlag) {
    console.error(
      "Este script es destructivo. Ejecútalo con --confirm para continuar.",
    );
    await queryClient.end();
    process.exit(1);
  }

  console.log("Iniciando reseteo completo de la app...\n");

  console.log("1) Eliminando usuarios de Supabase Auth...");
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Error listando usuarios de Auth: ${error.message}`);
    }

    const users = data.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        user.id,
      );
      if (deleteError && deleteError.message !== "User not found") {
        throw new Error(
          `Error eliminando usuario ${user.email || user.id}: ${deleteError.message}`,
        );
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }
  console.log("   Usuarios de Auth eliminados.");

  console.log("\n2) Eliminando objetos y buckets de Storage...");
  for (const bucketName of APP_BUCKETS) {
    const { data: bucket, error: bucketError } =
      await supabaseAdmin.storage.getBucket(bucketName);

    if (bucketError) {
      if (isBucketNotFoundError(bucketError.message)) {
        console.log(`   Bucket "${bucketName}" no existe, se omite.`);
        continue;
      }

      throw new Error(
        `Error consultando bucket ${bucketName}: ${bucketError.message}`,
      );
    }

    if (!bucket) {
      console.log(`   Bucket "${bucketName}" no existe, se omite.`);
      continue;
    }

    await deleteBucketObjects(bucketName);

    const { error: deleteBucketError } =
      await supabaseAdmin.storage.deleteBucket(bucketName);
    if (deleteBucketError) {
      throw new Error(
        `Error eliminando bucket ${bucketName}: ${deleteBucketError.message}`,
      );
    }

    console.log(`   Bucket "${bucketName}" eliminado.`);
  }

  console.log("\n3) Eliminando políticas de Storage...");
  for (const policyName of STORAGE_POLICIES) {
    await queryClient.unsafe(
      `DROP POLICY IF EXISTS "${policyName}" ON storage.objects;`,
    );
  }
  console.log("   Políticas de Storage eliminadas.");

  console.log("\n4) Eliminando tablas de la app...");
  for (const tableName of APP_TABLES) {
    await queryClient.unsafe(
      `DROP TABLE IF EXISTS public.${tableName} CASCADE;`,
    );
  }
  console.log("   Tablas eliminadas.");

  console.log("\n5) Eliminando secuencias de códigos públicos...");
  for (const sequenceName of APP_SEQUENCES) {
    await queryClient.unsafe(
      `DROP SEQUENCE IF EXISTS public.${sequenceName} CASCADE;`,
    );
  }
  console.log("   Secuencias eliminadas.");

  console.log("\nReseteo completo finalizado.");
  await queryClient.end();
  process.exit(0);
}

resetApp().catch(async (error) => {
  console.error("Error fatal en reset-app:", error);
  await queryClient.end();
  process.exit(1);
});

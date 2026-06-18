import "dotenv/config";
import { queryClient } from "../config/db.js";
import { supabaseAdmin } from "../config/supabase.js";

const BUCKETS = [
  {
    name: "vouchers",
    public: false,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
  },
  {
    name: "avatars",
    public: false,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 2 * 1024 * 1024, // 2 MB
  },
];

const STORAGE_POLICY_SQL = [
  `DROP POLICY IF EXISTS "avatars_admin_all" ON storage.objects;`,
  `DROP POLICY IF EXISTS "avatars_owner_self_all" ON storage.objects;`,
  `DROP POLICY IF EXISTS "vouchers_admin_all" ON storage.objects;`,
  `DROP POLICY IF EXISTS "vouchers_client_read" ON storage.objects;`,
  `DROP POLICY IF EXISTS "vouchers_investor_read" ON storage.objects;`,
  `DROP POLICY IF EXISTS "vouchers_client_manage_own" ON storage.objects;`,
  `
    CREATE POLICY "avatars_admin_all"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.auth_user_id = auth.uid()::text
          AND (users.role = 'admin' OR users.is_owner = true)
      )
    )
    WITH CHECK (
      bucket_id = 'avatars'
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.auth_user_id = auth.uid()::text
          AND (users.role = 'admin' OR users.is_owner = true)
      )
    );
  `,
  `
    CREATE POLICY "avatars_owner_self_all"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id::text = split_part(name, '/', 1)
          AND users.auth_user_id = auth.uid()::text
      )
    )
    WITH CHECK (
      bucket_id = 'avatars'
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id::text = split_part(name, '/', 1)
          AND users.auth_user_id = auth.uid()::text
      )
    );
  `,
  `
    CREATE POLICY "vouchers_admin_all"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'vouchers'
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.auth_user_id = auth.uid()::text
          AND (users.role = 'admin' OR users.is_owner = true)
      )
    )
    WITH CHECK (
      bucket_id = 'vouchers'
      AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.auth_user_id = auth.uid()::text
          AND (users.role = 'admin' OR users.is_owner = true)
      )
    );
  `,
  `
    CREATE POLICY "vouchers_client_read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'vouchers'
      AND EXISTS (
        SELECT 1
        FROM payment_vouchers pv
        INNER JOIN loans l ON l.id = pv.loan_id
        INNER JOIN users u ON u.id = l.client_id
        WHERE pv.evidence_url = ('storage://vouchers/' || name)
          AND u.auth_user_id = auth.uid()::text
      )
    );
  `,
  `
    CREATE POLICY "vouchers_investor_read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'vouchers'
      AND EXISTS (
        SELECT 1
        FROM payment_vouchers pv
        INNER JOIN loans l ON l.id = pv.loan_id
        INNER JOIN users u ON u.id = l.investor_id
        WHERE pv.evidence_url = ('storage://vouchers/' || name)
          AND u.auth_user_id = auth.uid()::text
      )
    );
  `,
  `
    CREATE POLICY "vouchers_client_manage_own"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'vouchers'
      AND EXISTS (
        SELECT 1
        FROM payment_vouchers pv
        INNER JOIN loans l ON l.id = pv.loan_id
        INNER JOIN users u ON u.id = l.client_id
        WHERE pv.evidence_url = ('storage://vouchers/' || name)
          AND u.auth_user_id = auth.uid()::text
      )
    )
    WITH CHECK (
      bucket_id = 'vouchers'
      AND EXISTS (
        SELECT 1
        FROM payment_vouchers pv
        INNER JOIN loans l ON l.id = pv.loan_id
        INNER JOIN users u ON u.id = l.client_id
        WHERE pv.evidence_url = ('storage://vouchers/' || name)
          AND u.auth_user_id = auth.uid()::text
      )
    );
  `,
];

const applyStoragePolicies = async (): Promise<void> => {
  for (const statement of STORAGE_POLICY_SQL) {
    await queryClient.unsafe(statement);
  }
};

export async function setupStorage(): Promise<void> {
  console.log("Configurando Supabase Storage...\n");

  for (const bucket of BUCKETS) {
    // Verificar si ya existe
    const { data: existing } = await supabaseAdmin.storage.getBucket(
      bucket.name,
    );

    if (existing) {
      console.log(`  Bucket "${bucket.name}" ya existe.`);
      // Actualizar configuración
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(
        bucket.name,
        {
          public: bucket.public,
          allowedMimeTypes: bucket.allowedMimeTypes,
          fileSizeLimit: bucket.fileSizeLimit,
        },
      );
      if (updateError) {
        console.error(
          `  Error actualizando "${bucket.name}": ${updateError.message}`,
        );
      } else {
        console.log(`  Configuración de "${bucket.name}" actualizada.`);
      }
    } else {
      // Crear bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket(
        bucket.name,
        {
          public: bucket.public,
          allowedMimeTypes: bucket.allowedMimeTypes,
          fileSizeLimit: bucket.fileSizeLimit,
        },
      );
      if (createError) {
        console.error(
          `  Error creando "${bucket.name}": ${createError.message}`,
        );
      } else {
        console.log(`  Bucket "${bucket.name}" creado correctamente.`);
      }
    }
  }

  console.log("\nModelo aplicado:");
  console.log("  - vouchers: bucket privado");
  console.log(
    "  - acceso a vouchers mediante backend + signed URLs temporales",
  );
  console.log("  - avatars: bucket privado");
  console.log("  - acceso a avatars mediante backend + signed URLs temporales");
  await applyStoragePolicies();
  console.log("  - políticas RLS de storage.objects aplicadas");
  console.log("\nSetup de Storage completado.");
}

const isDirectExecution =
  process.argv[1]?.endsWith("setup-storage.ts") ||
  process.argv[1]?.endsWith("setup-storage.js");

if (isDirectExecution) {
  setupStorage()
    .catch((err) => {
      console.error("Error fatal:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await queryClient.end();
    });
}

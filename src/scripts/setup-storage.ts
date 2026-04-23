/**
 * Script de configuración de Supabase Storage.
 * Crea/actualiza buckets de forma idempotente.
 *
 * Nota:
 * En esta arquitectura el frontend no accede directo a Storage para vouchers.
 * El backend usa service_role para subir archivos y genera signed URLs al leerlos,
 * por lo que no dependemos de políticas RLS sobre storage.objects para el flujo actual.
 * Uso: npx tsx src/scripts/setup-storage.ts
 */
import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const isDryRun = process.argv.includes("--dry-run");

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

async function setupStorage() {
  console.log(`Configurando Supabase Storage${isDryRun ? " (dry-run)" : ""}...\n`);

  for (const bucket of BUCKETS) {
    if (isDryRun) {
      console.log(`  Bucket "${bucket.name}": public=${bucket.public}, fileSizeLimit=${bucket.fileSizeLimit}`);
      continue;
    }

    // Verificar si ya existe
    const { data: existing } = await supabaseAdmin.storage.getBucket(bucket.name);
    
    if (existing) {
      console.log(`  Bucket "${bucket.name}" ya existe.`);
      // Actualizar configuración
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.allowedMimeTypes,
        fileSizeLimit: bucket.fileSizeLimit,
      });
      if (updateError) {
        console.error(`  Error actualizando "${bucket.name}": ${updateError.message}`);
      } else {
        console.log(`  Configuración de "${bucket.name}" actualizada.`);
      }
    } else {
      // Crear bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.allowedMimeTypes,
        fileSizeLimit: bucket.fileSizeLimit,
      });
      if (createError) {
        console.error(`  Error creando "${bucket.name}": ${createError.message}`);
      } else {
        console.log(`  Bucket "${bucket.name}" creado correctamente.`);
      }
    }
  }

  if (isDryRun) {
    console.log("  Vouchers usa bucket privado + signed URLs emitidas por backend.");
    console.log("  Avatars usa bucket privado + signed URLs emitidas por backend.");
    console.log("  No se aplican políticas RLS de storage.objects en este flujo porque el acceso a Storage no es directo desde cliente.");
    console.log("\nDry-run completado.");
    process.exit(0);
  }

  console.log("\nModelo aplicado:");
  console.log("  - vouchers: bucket privado");
  console.log("  - acceso a vouchers mediante backend + signed URLs temporales");
  console.log("  - avatars: bucket privado");
  console.log("  - acceso a avatars mediante backend + signed URLs temporales");
  console.log("\nSetup de Storage completado.");
  process.exit(0);
}

setupStorage().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

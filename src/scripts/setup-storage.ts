/**
 * Script de configuración de buckets de Supabase Storage.
 * Ejecutar una vez para crear los buckets necesarios.
 * Uso: npx tsx src/scripts/setup-storage.ts
 */
import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const BUCKETS = [
  {
    name: "vouchers",
    public: true,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
  },
  {
    name: "avatars",
    public: true,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 2 * 1024 * 1024, // 2 MB
  },
];

async function setupStorage() {
  console.log("🗂️  Configurando buckets de Supabase Storage...\n");

  for (const bucket of BUCKETS) {
    // Verificar si ya existe
    const { data: existing } = await supabaseAdmin.storage.getBucket(bucket.name);
    
    if (existing) {
      console.log(`  ✅ Bucket "${bucket.name}" ya existe.`);
      // Actualizar configuración
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.allowedMimeTypes,
        fileSizeLimit: bucket.fileSizeLimit,
      });
      if (updateError) {
        console.error(`  ⚠️  Error actualizando "${bucket.name}": ${updateError.message}`);
      } else {
        console.log(`  🔄 Configuración de "${bucket.name}" actualizada.`);
      }
    } else {
      // Crear bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.allowedMimeTypes,
        fileSizeLimit: bucket.fileSizeLimit,
      });
      if (createError) {
        console.error(`  ❌ Error creando "${bucket.name}": ${createError.message}`);
      } else {
        console.log(`  ✅ Bucket "${bucket.name}" creado correctamente.`);
      }
    }
  }

  console.log("\n✅ Setup de Storage completado.");
  process.exit(0);
}

setupStorage().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

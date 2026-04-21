import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

const isTest = process.env.VITEST === "true";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.warn("Credenciales de Supabase no configuradas completamente.");
}

// Cliente estándar para acciones de usuario
export const supabase = createClient(
  env.SUPABASE_URL || "",
  env.SUPABASE_ANON_KEY || "",
);

// Cliente administrativo
const serviceRoleKey = isTest
  ? env.SUPABASE_SERVICE_ROLE_KEY_TEST || env.SUPABASE_SERVICE_ROLE_KEY
  : env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  env.SUPABASE_URL || "",
  serviceRoleKey || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

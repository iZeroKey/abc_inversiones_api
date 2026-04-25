import { z } from "zod";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const getEnv = (prodKey: string, testKey: string) => {
  return isTest ? process.env[testKey] : process.env[prodKey];
};

const msg = (key: string) => ({
  message: `Falta la variable: ${isTest ? key + "_TEST" : key}`,
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1).default("abc-inversiones-api"),
  APP_TIMEZONE: z.string().default("UTC"),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  OCR_ENABLED: z.coerce.boolean().default(true),
  OCR_PROVIDER: z.enum(["google-vision"]).default("google-vision"),
  SUPABASE_URL: z.string(msg("SUPABASE_URL")).url("URL de Supabase inválida"),
  SUPABASE_ANON_KEY: z.string(msg("SUPABASE_ANON_KEY")).min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string(msg("SUPABASE_SERVICE_ROLE_KEY")).min(1),
  DATABASE_URL: z.string(msg("DATABASE_URL")).min(1),
});

const parsedEnv = envSchema.safeParse({
  ...process.env,
  SUPABASE_URL: getEnv("SUPABASE_URL", "SUPABASE_URL_TEST"),
  SUPABASE_ANON_KEY: getEnv("SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY_TEST"),
  SUPABASE_SERVICE_ROLE_KEY: getEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY_TEST"),
  DATABASE_URL: getEnv("DATABASE_URL", "DATABASE_URL_TEST"),
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((i) => i.message)
    .join("\n");
    
  throw new Error(`Error de configuración de entorno:\n${issues}`);
}

export const env = parsedEnv.data;
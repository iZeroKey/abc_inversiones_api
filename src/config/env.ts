import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1).default("abc-inversiones-api"),
  APP_TIMEZONE: z.string().default("UTC"),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  OCR_ENABLED: z.coerce.boolean().default(true),
  OCR_PROVIDER: z.enum(["google-vision"]).default("google-vision"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.url({
    message: "La variable SUPABASE_URL debe ser una URL válida",
  }),
  SUPABASE_ANON_KEY: z
    .string({ message: "Falta la variable: SUPABASE_ANON_KEY" })
    .min(1),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ message: "Falta la variable: SUPABASE_SERVICE_ROLE_KEY" })
    .min(1),
  DATABASE_URL: z.string({ message: "Falta la variable: DATABASE_URL" }).min(1),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((i) => i.message).join("\n");

  throw new Error(`Error de configuración de entorno:\n${issues}`);
}

export const env = parsedEnv.data;

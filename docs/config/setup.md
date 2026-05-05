# Configuración del Proyecto

## Tabla de Contenidos

1. [Variables de Entorno](#variables-de-entorno)
2. [Configuración de Base de Datos](#configuración-de-base-de-datos)
3. [Supabase](#supabase)
4. [Bootstrap](#bootstrap)

---

## Variables de Entorno

El proyecto utiliza un schema de validación con Zod. Las variables requeridas deben estar presentes en el archivo `.env`.

### Requeridas

| Variable                    | Tipo   | Descripción                   |
| --------------------------- | ------ | ----------------------------- |
| `SUPABASE_URL`              | string | URL del proyecto Supabase     |
| `SUPABASE_ANON_KEY`         | string | Clave anónima pública         |
| `SUPABASE_SERVICE_ROLE_KEY` | string | Clave de service role (admin) |
| `DATABASE_URL`              | string | URL de conexión a PostgreSQL  |

### Opcionales

| Variable                         | Tipo    | Default             | Descripción               |
| -------------------------------- | ------- | ------------------- | ------------------------- |
| `NODE_ENV`                       | string  | development         | Entorno de ejecución      |
| `PORT`                           | number  | 3000                | Puerto del servidor       |
| `APP_NAME`                       | string  | abc-inversiones-api | Nombre de la app          |
| `APP_TIMEZONE`                   | string  | UTC                 | Zona horaria              |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | number  | 900                 | TTL para URLs firmadas    |
| `OCR_ENABLED`                    | boolean | true                | Habilitar OCR de vouchers |
| `OCR_PROVIDER`                   | string  | google-vision       | Proveedor de OCR          |
| `DATABASE_TEST_URL`              | string  | -                   | URL para tests            |

### Ejemplo de .env

```text
NODE_ENV=development
PORT=3000
APP_NAME=abc-inversiones-api

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...

DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

---

## Configuración de Base de Datos

La configuración de la conexión a PostgreSQL se encuentra en `src/config/db.ts`.

### Parámetros de Pool

| Parámetro         | Default | Descripción                                   |
| ----------------- | ------- | --------------------------------------------- |
| `max`             | 10      | Máximo de conexiones en el pool               |
| `idle_timeout`    | 20      | Segundos antes de cerrar conexiones inactivas |
| `connect_timeout` | 30      | Segundos antes de timeout de conexión         |
| `prepare`         | false   | Desactivar prepared statements                |
| `max_lifetime`    | 60000   | Tiempo máximo de vida de una conexión (ms)    |

### Código

```typescript
const queryClient = postgres(databaseUrl, {
  max: isTest ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: false,
  max_lifetime: 60000,
});
```

---

## Supabase

### Auth

La autenticación se realiza mediante Supabase Auth. Los tokens JWT son validados en cada petición privada mediante el middleware `authenticate`.

### Storage

El proyecto utiliza buckets privado para almacenar archivos sensibles:

| Bucket     | Descripción                    |
| ---------- | ------------------------------ |
| `avatars`  | Imágenes de perfil de usuarios |
| `vouchers` | Comprobantes de pago           |

### Row Level Security (RLS)

Todas las tablas tienen políticas RLS configuradas en el schema de Drizzle:

| Tabla            | Políticas                                 |
| ---------------- | ----------------------------------------- |
| users            | admin_full, user_self                     |
| loans            | admin_all, client_select, investor_select |
| installments     | admin_all, client_select, investor_select |
| payments         | admin_all, client_select, investor_select |
| payment_vouchers | admin_all, client_self, investor_view     |
| access_requests  | admin_all, public_insert                  |
| audit_logs       | admin_all, user_self                      |
| notifications    | admin_all, user_self                      |

---

## Bootstrap

### Pasos de Configuración

1. **Instalar dependencias**

```bash
pnpm install
```

2. **Crear archivo .env**

```bash
cp .env.example .env
# Completar las variables requeridas
```

3. **Aplicar esquema**

```bash
pnpm db:push
```

4. **Configurar Storage**

```bash
pnpm setup:storage
```

5. **Ejecutar tests**

```bash
pnpm test
```

6. **Iniciar desarrollo**

```bash
pnpm dev
```

### Scripts Disponibles

| Comando               | Descripción                    |
| --------------------- | ------------------------------ |
| `pnpm dev`            | Iniciar servidor en desarrollo |
| `pnpm build`          | Compilar TypeScript            |
| `pnpm start`          | Iniciar producción             |
| `pnpm typecheck`      | Verificar tipos                |
| `pnpm test`           | Ejecutar pruebas               |
| `pnpm lint`           | Verificar código               |
| `pnpm db:push`        | Aplicar esquema a DB           |
| `pnpm db:seed`        | Sembrar datos iniciales        |
| `pnpm setup:storage`  | Configurar buckets             |
| `pnpm check:overdue`  | Verificar cuotas vencidas      |
| `pnpm send:reminders` | Enviar recordatorios           |

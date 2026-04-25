# Configuracion del Proyecto

## Tabla de Contenidos

1. [Variables de Entorno](#variables-de-entorno)
2. [Configuracion de Base de Datos](#configuracion-de-base-de-datos)
3. [Supabase](#supabase)
4. [Bootstrap](#bootstrap)

---

## Variables de Entorno

El proyecto utiliza un schema de validacion con Zod. Las variables requeridas deben estar presentes en el archivo `.env`.

### Requeridas

| Variable                    | Tipo   | Descripcion                   |
| --------------------------- | ------ | ----------------------------- |
| `SUPABASE_URL`              | string | URL del proyecto Supabase     |
| `SUPABASE_ANON_KEY`         | string | Clave anonima pública         |
| `SUPABASE_SERVICE_ROLE_KEY` | string | Clave de service role (admin) |
| `DATABASE_URL`              | string | URL de conexion a PostgreSQL  |

### Opcionales

| Variable                         | Tipo    | Default             | Descripcion               |
| -------------------------------- | ------- | ------------------- | ------------------------- |
| `NODE_ENV`                       | string  | development         | Entorno de ejecucion      |
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

## Configuracion de Base de Datos

La configuracion de la conexion a PostgreSQL se encuentra en `src/config/db.ts`.

### Parametros de Pool

| Parametro         | Default | Descripcion                                   |
| ----------------- | ------- | --------------------------------------------- |
| `max`             | 10      | Maximo de conexiones en el pool               |
| `idle_timeout`    | 20      | Segundos antes de cerrar conexiones inactivas |
| `connect_timeout` | 30      | Segundos antes de timeout de conexion         |
| `prepare`         | false   | Desactivar prepared statements                |
| `max_lifetime`    | 60000   | Tiempo maximo de vida de una conexion (ms)    |

### Codigo

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

La autenticacion se realiza mediante Supabase Auth. Los tokens JWT son validados en cada peticion privada mediante el middleware `authenticate`.

### Storage

El proyecto utiliza buckets privado para almacenar archivos sensibles:

| Bucket     | Descripcion                    |
| ---------- | ------------------------------ |
| `avatars`  | Imagenes de perfil de usuarios |
| `vouchers` | Comprobantes de pago           |

### Row Level Security (RLS)

Todas las tablas tienen politicas RLS configuradas en el schema de Drizzle:

| Tabla            | Politicas                                 |
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

### Pasos de Configuracion

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

| Comando               | Descripcion                    |
| --------------------- | ------------------------------ |
| `pnpm dev`            | Iniciar servidor en desarrollo |
| `pnpm build`          | Compilar TypeScript            |
| `pnpm start`          | Iniciar produccion             |
| `pnpm typecheck`      | Verificar tipos                |
| `pnpm test`           | Ejecutar pruebas               |
| `pnpm lint`           | Verificar codigo               |
| `pnpm db:push`        | Aplicar esquema a DB           |
| `pnpm db:seed`        | Sembrar datos iniciales        |
| `pnpm setup:storage`  | Configurar buckets             |
| `pnpm check:overdue`  | Verificar cuotas vencidas      |
| `pnpm send:reminders` | Enviar recordatorios           |

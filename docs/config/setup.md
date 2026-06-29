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

### Para Pruebas (Test)

Estas variables son requeridas únicamente cuando se ejecutan las pruebas (`NODE_ENV=test` o en Vitest):

| Variable                         | Tipo   | Descripción                                |
| -------------------------------- | ------ | ------------------------------------------ |
| `SUPABASE_URL_TEST`              | string | URL del proyecto Supabase para pruebas     |
| `SUPABASE_ANON_KEY_TEST`         | string | Clave anónima pública para pruebas         |
| `SUPABASE_SERVICE_ROLE_KEY_TEST` | string | Clave de service role (admin) para pruebas |
| `DATABASE_URL_TEST`              | string | URL de conexión a PostgreSQL para pruebas  |

### Ejemplo de .env

```text
# App
NODE_ENV=development
PORT=3000
APP_NAME=abc-inversiones-api
APP_TIMEZONE=America/Lima

# Desarrollo / Producción
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# Pruebas
SUPABASE_URL_TEST=https://xxxxx-test.supabase.co
SUPABASE_ANON_KEY_TEST=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
SUPABASE_SERVICE_ROLE_KEY_TEST=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
DATABASE_URL_TEST=postgresql://postgres:password@db.xxxxx-test.supabase.co:5432/postgres
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
| `prepare`         | false*  | Prepared statements (desactivado en test)     |
| `max_lifetime`    | 60000   | Tiempo máximo de vida de una conexión (ms)    |

### Código

```typescript
const queryClient = postgres(databaseUrl, {
  max: isTest ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: env.NODE_ENV !== "test",
  max_lifetime: 60000,
});
```

> `prepare: env.NODE_ENV !== "test"`: los prepared statements están **habilitados** en desarrollo y producción para mejorar el rendimiento de consultas repetitivas. Se desactivan en test (`NODE_ENV=test`) para evitar problemas con el pool de conexiones.

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

### Middleware Global

El servidor Express registra los siguientes middleware en orden:

1. `compression()` — Compresión gzip/brotli para todas las respuestas.
2. `helmet()` — Cabeceras de seguridad.
3. `cors()` — Control de acceso CORS.
4. `express.json({ limit: "2mb" })` — Parseo de JSON (límite 2 MB).
5. Cache-Control — `private, no-cache` en todas las rutas (salvo `/health` que usa `public, max-age=300`).

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
# Completar las variables requeridas (de desarrollo y/o de pruebas)
```

3. **Inicializar la aplicación (Recomendado)**

La forma más rápida y segura de preparar el entorno es ejecutar el comando unificado:

```bash
pnpm app:setup
```

Este comando realiza de manera secuencial los siguientes pasos:

- **`pnpm db:push`**: Sincroniza el esquema de base de datos de Drizzle directamente con PostgreSQL.
- **`pnpm setup:rls`**: Ejecuta las consultas necesarias para habilitar políticas RLS (Row Level Security).
- **`pnpm db:seed`**: Siembra los datos esenciales (usuarios administradores base, roles iniciales).
- **`pnpm public-codes:backfill`**: Asegura que todos los registros clave tengan códigos públicos formateados.
- **`pnpm db:timezone`**: Configura la zona horaria correcta en el motor de base de datos.
- **`pnpm setup:storage`**: Inicializa y configura los buckets de almacenamiento en Supabase (`avatars` y `vouchers`).
- **`pnpm setup:storage:dry-run`**: Comprueba y valida la conexión final de almacenamiento.

_Si prefieres ejecutar estos pasos uno por uno, puedes consultar la sección de [Scripts Disponibles](#scripts-disponibles)._

4. **Limpieza o reinicio (Opcional)**

Si en algún momento necesitas vaciar por completo la base de datos para volver a ejecutar el setup desde cero, ejecuta:

```bash
pnpm app:reset
```

_Advertencia: Esto borrará permanentemente todas las tablas en el esquema público de la base de datos configurada._

5. **Ejecutar pruebas (Opcional)**

Para validar que el entorno de pruebas está bien configurado y el código pasa las pruebas de integración:

```bash
pnpm test
```

6. **Iniciar desarrollo**

Inicia el servidor local en modo observador:

```bash
pnpm dev
```

Opcionalmente, con el servidor local encendido, puedes sembrar datos de prueba usando llamadas reales al API:

```bash
pnpm db:seed:api
```

Por defecto usa `http://localhost:3000/api/v1`, autentica al owner `admin@abc.com` y crea/actualiza usuarios `api.*@abc.com`. Puedes ajustar `API_SEED_BASE_URL`, `API_SEED_OWNER_EMAIL`, `API_SEED_OWNER_PASSWORD` y `API_SEED_DEFAULT_PASSWORD`.

---

### Scripts Disponibles

A continuación se detallan todos los scripts que se pueden ejecutar desde el archivo `package.json`:

| Comando                      | Descripción                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm dev`                   | Inicia el servidor de desarrollo local usando `tsx watch` (observa cambios en caliente).             |
| `pnpm build`                 | Compila el proyecto TypeScript en código JavaScript nativo dentro de la carpeta `dist/`.             |
| `pnpm start`                 | Inicia el servidor en producción utilizando los archivos compilados en `dist/server.js`.             |
| `pnpm typecheck`             | Ejecuta el compilador de TypeScript en modo validación de tipos sin emitir ningún archivo.           |
| `pnpm test`                  | Ejecuta la suite de pruebas de integración completa con Vitest una sola vez.                         |
| `pnpm test:watch`            | Ejecuta las pruebas en modo interactivo observando los cambios en los archivos.                      |
| `pnpm lint`                  | Ejecuta la validación de código y formato de estilos con ESLint.                                     |
| `pnpm lint:fix`              | Valida y corrige automáticamente problemas menores de estilo o sintaxis con ESLint.                  |
| `pnpm app:setup`             | Inicialización unificada de la aplicación (db:push, setup:rls, db:seed, backfill, timezone, storage) |
| `pnpm app:reset`             | Restablece por completo la base de datos (elimina y recrea el esquema público).                      |
| `pnpm db:push`               | Empuja el esquema local definido en Drizzle a la base de datos de forma directa.                     |
| `pnpm db:generate`           | Genera archivos de migración (SQL) de Drizzle Kit.                                                   |
| `pnpm db:migrate`            | Ejecuta migraciones de base de datos acumuladas.                                                     |
| `pnpm db:seed`               | Siembra los datos esenciales (iniciales y obligatorios) directo en la base de datos.                 |
| `pnpm db:seed:api`           | Siembra datos adicionales enviando peticiones HTTP reales (requiere servidor local activo).          |
| `pnpm db:seed:demo-api`      | Siembra un flujo de prueba completo de demo (préstamos, vouchers en revisión, cuotas) mediante API.  |
| `pnpm public-codes:backfill` | Genera códigos públicos autogenerados (`publicCode`) en registros de usuarios/préstamos existentes.  |
| `pnpm db:timezone`           | Configura y valida la zona horaria en la base de datos PostgreSQL.                                   |
| `pnpm setup:rls`             | Habilita y actualiza las políticas de Row Level Security (RLS) en la base de datos.                  |
| `pnpm setup:storage`         | Crea y configura los buckets privados de Supabase (`avatars`, `vouchers`).                           |
| `pnpm setup:storage:dry-run` | Valida la conectividad y existencia de los buckets de Supabase sin hacer modificaciones.             |
| `pnpm check:overdue`         | Verifica cuotas cuyo vencimiento haya pasado y actualiza su estado a `overdue`.                      |
| `pnpm send:reminders`        | Envía recordatorios para notificar a los clientes sobre cuotas por vencer o vencidas.                |

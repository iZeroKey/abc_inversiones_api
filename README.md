# ABC Inversiones API

Backend de ABC Inversiones para la gestión de usuarios, solicitudes de acceso, préstamos, cuotas, pagos, vouchers, auditoría, notificaciones y reportes.

## Tabla de Contenidos

1. [Información General](#información-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura](#arquitectura)
4. [Roles y Permisos](#roles-y-permisos)
5. [Modelo de Datos](#modelo-de-datos)
6. [API Endpoints](#api-endpoints)
7. [Configuración](#configuración)
8. [Scripts](#scripts)
9. [Seguridad](#seguridad)

---

## Información General

- **Empresa**: ABC Inversiones S.A.C.
- **Nombre del proyecto**: abc-inversiones-api
- **Versión**: 1.0.0
- **Tipo**: API RESTful

ABC Inversiones es una plataforma de gestión de préstamos que permite:

- Autenticación y control de acceso por roles
- Gestión de solicitudes de acceso de clientes e inversionistas
- Creación y seguimiento de préstamos
- Generación automática de cuotas
- Registro y validación de pagos
- Carga de vouchers con flujo de revisión
- OCR asistido para completar formularios
- Auditoría de acciones sensibles
- Notificaciones internas
- Reportes operativos

---

## Stack Tecnológico

- **Runtime**: Node.js
- **Lenguaje**: TypeScript
- **Framework**: Express
- **ORM**: Drizzle ORM
- **Base de datos**: PostgreSQL (Supabase)
- **Autenticación**: Supabase Auth
- **Almacenamiento**: Supabase Storage
- **Upload Streaming**: Busboy (multipart parser de bajo nivel)
- **OCR**: Google Cloud Vision API
- **Logging**: Pino

---

## Arquitectura

```
src/
├── config/          # DB, env, logger, supabase client
├── db/schema/       # Esquemas Drizzle ORM
├── middleware/
│   ├── auth.middleware.ts           # JWT vía Supabase Auth
│   ├── role.middleware.ts           # Autorización por rol
│   ├── stream-upload.middleware.ts  # Busboy streaming/buffer (vouchers, OCR, avatars)
│   └── error-handler.middleware.ts  # Manejo global de errores
├── modules/         # Lógica de negocio por módulo
├── routes/          # Definición de endpoints
├── scripts/         # Seed, setup, mantenimiento
├── utils/           # Storage, audit, notifications, etc.
├── realtime/        # WebSocket para notificaciones
└── tests/           # Tests de integración (vitest + supertest)
```

### Estrategia de Upload: Streaming Pass-Through

El backend usa dos estrategias de upload según el endpoint:

| Endpoint | Middleware | Estrategia | Límite | Razón |
|---|---|---|---|---|
| `POST /payment-vouchers` | `streamVoucherUpload` (busboy) | Stream → Storage | 5 MB | Los bytes fluyen al Storage sin acumular en RAM |
| `POST /payment-vouchers/analyze` | `bufferOcrUpload` (busboy) | Buffer → Vision API | 1.5 MB | Vision API necesita la imagen completa |
| `PATCH /users/me/avatar` | `bufferAvatarUpload` (busboy) | Buffer → Storage | 2 MB | Reemplazo seguro del avatar anterior |

**¿Por qué streaming?** La API se despliega en Cloud Run (Santiago) detrás de un Cloudflare Worker con límite de 100s por conexión. Con multer, el archivo se acumula en RAM antes de procesarse; con busboy, los campos de texto se procesan **durante** la subida del archivo, permitiendo validación concurrente y reduciendo el tiempo total de respuesta.

---

## Roles y Permisos

| Rol        | Descripción   | Permisos                            |
| ---------- | ------------- | ----------------------------------- |
| `owner`    | Dueño         | Crea cualquier rol y gestiona cualquier usuario |
| `admin`    | Administrador | Gestiona usuarios no administradores y módulos operativos |
| `client`   | Cliente       | Ver sus préstamos, subir vouchers   |
| `investor` | Inversionista | Ver sus préstamos, revisar vouchers |

### Flujo de Validación

1. **Cliente**: Solo ve sus propios préstamos y vouchers
2. **Inversionista**: Ve préstamos asignados, puede aprobar/rechazar vouchers preliminarmente
3. **Admin**: Gestión operativa, sin modificar otros administradores
4. **Owner**: Acceso total, incluyendo creación y gestión de administradores

Los roles de usuarios son inmutables después de la creación. Todos los usuarios tienen `publicCode`: `AD-00001` para administradores, `CL-00001` para clientes, `IN-00001` para inversionistas y `PR-00001` para préstamos. Clientes e inversionistas pueden existir como registros operativos sin cuenta Auth; cuando se vinculan a Auth se guarda `authUserId`.

---

## Modelo de Datos

### Tablas

| Tabla              | Descripción           |
| ------------------ | --------------------- |
| `users`            | Usuarios registrados  |
| `access_requests`  | Solicitudes de acceso |
| `loans`            | Préstamos             |
| `installments`     | Cuotas de préstamos   |
| `payments`         | Pagos registrados     |
| `payment_vouchers` | Vouchers de pago      |
| `audit_logs`       | Log de auditoría      |
| `notifications`    | Notificaciones        |

### Detalles de Tablas

#### users

| Campo        | Tipo       | Descripción              |
| ------------ | ---------- | ------------------------ |
| `id`         | uuid       | ID interno de la API     |
| `auth_user_id` | text    | ID nullable de Supabase Auth |
| `public_code` | text       | Código público operativo |
| `first_name` | text       | Nombres                  |
| `last_name`  | text       | Apellidos                |
| `email`      | text       | Correo electrónico nullable |
| `phone`      | text       | Teléfono                 |
| `dni`        | text       | Documento nullable       |
| `address`    | text       | Domicilio nullable       |
| `bank`       | text       | Banco nullable           |
| `bank_accounts` | text[]  | Números de cuenta        |
| `marital_status` | enum   | single, married, unspecified |
| `avatar_url` | text       | URL del avatar           |
| `role`       | enum       | admin, client, investor  |
| `is_owner`   | boolean    | Es propietario           |
| `active`     | boolean    | Está activo              |
| `created_at` | timestamp  | Fecha de creación        |
| `updated_at` | timestamp  | Fecha de actualización   |
| `deleted_at` | timestamp  | Fecha de eliminación     |

#### access_requests

| Campo             | Tipo      | Descripción                            |
| ----------------- | --------- | -------------------------------------- |
| `id`              | uuid      | ID único                               |
| `email`           | text      | Correo solicitante                     |
| `first_name`      | text      | Nombres                                |
| `last_name`       | text      | Apellidos                              |
| `phone`           | text      | Teléfono                               |
| `role_requested`  | enum      | client, investor                       |
| `status`          | enum      | pending, in_review, approved, rejected |
| `additional_data` | jsonb     | Datos adicionales                      |
| `observation`     | text      | Observación                            |
| `created_at`      | timestamp | Fecha de creación                      |
| `updated_at`      | timestamp | Fecha de actualización                 |

#### loans

| Campo                | Tipo      | Descripción                                                                             |
| -------------------- | --------- | --------------------------------------------------------------------------------------- |
| `id`                 | uuid      | ID único                                                                                |
| `client_id`          | uuid      | ID interno del cliente                                                                  |
| `investor_id`        | uuid      | ID interno del inversionista                                                            |
| `principal`          | numeric   | Monto principal                                                                         |
| `interest_rate`      | numeric   | Tasa de interés                                                                         |
| `interest_type`      | enum      | simple, compound                                                                        |
| `interest_period`    | enum      | monthly, annual                                                                         |
| `installments_count` | integer   | Número de cuotas                                                                        |
| `frequency`          | enum      | daily, weekly, biweekly, monthly                                                        |
| `payment_day`        | integer   | Día de pago                                                                             |
| `total_debt`         | numeric   | Deuda total                                                                             |
| `status`             | enum      | draft, pending_investor_review, pending_admin_review, active, rejected, paid, defaulted, deleted |
| `overpaid_amount`    | numeric   | Monto pagado por encima de la deuda vigente                                             |
| `is_company_funded`  | boolean   | financiado por empresa                                                                  |
| `start_date`         | timestamp | Fecha de inicio                                                                         |
| `observation`        | text      | Observación                                                                             |
| `created_at`         | timestamp | Fecha de creación                                                                       |
| `updated_at`         | timestamp | Fecha de actualización                                                                  |
| `deleted_at`         | timestamp | Fecha de eliminación lógica                                                             |

#### installments

| Campo                | Tipo      | Descripción            |
| -------------------- | --------- | ---------------------- |
| `id`                 | uuid      | ID único               |
| `loan_id`            | uuid      | ID del préstamo        |
| `installment_number` | integer   | Número de cuota        |
| `due_date`           | timestamp | Fecha de vencimiento   |
| `amount`             | numeric   | Monto de la cuota      |
| `paid_amount`        | numeric   | Monto pagado           |
| `status`             | enum      | pending, paid, overdue |
| `created_at`         | timestamp | Fecha de creación      |
| `updated_at`         | timestamp | Fecha de actualización |

#### payments

| Campo              | Tipo      | Descripción                    |
| ------------------ | --------- | ------------------------------ |
| `id`               | uuid      | ID único                       |
| `loan_id`          | uuid      | ID del préstamo                |
| `installment_id`   | uuid      | ID de la cuota                 |
| `voucher_id`       | uuid      | Voucher asociado, si aplica   |
| `amount`           | numeric   | Monto del pago                 |
| `payment_date`     | timestamp | Fecha del pago                 |
| `method`           | enum      | cash, transfer, deposit, other |
| `reference`        | text      | Referencia                     |
| `observation`      | text      | Observación                    |
| `evidence_url`     | text      | Evidencia opcional del pago    |
| `registered_by_id` | uuid      | ID de quien registra           |
| `status`           | enum      | confirmed, reversed            |
| `created_at`       | timestamp | Fecha de creación              |
| `updated_at`       | timestamp | Fecha de actualización         |
| `deleted_at`       | timestamp | Fecha de eliminación lógica    |

#### payment_vouchers

| Campo             | Tipo      | Descripción                                                                                          |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `id`              | uuid      | ID único                                                                                             |
| `loan_id`         | uuid      | ID del préstamo                                                                                      |
| `client_id`       | uuid      | ID interno del cliente                                                                               |
| `amount`          | numeric   | Monto del voucher                                                                                    |
| `operation_id`    | text      | ID de operación bancaria                                                                             |
| `operation_date`  | timestamp | Fecha de operación                                                                                   |
| `evidence_url`    | text      | URL de la evidencia                                                                                  |
| `status`          | enum      | draft, pending_investor_review, pending_admin_review, investor_approved, investor_rejected, owner_approved, owner_rejected, deleted |
| `observation`     | text      | Observación                                                                                          |
| `processed_by_id` | uuid      | ID interno de quien procesó                                                                          |
| `created_at`      | timestamp | Fecha de creación                                                                                    |
| `updated_at`      | timestamp | Fecha de actualización                                                                               |
| `deleted_at`      | timestamp | Fecha de eliminación lógica                                                                          |

#### audit_logs

| Campo        | Tipo      | Descripción       |
| ------------ | --------- | ----------------- |
| `id`         | uuid      | ID único          |
| `user_id`    | uuid      | ID del usuario    |
| `action`     | text      | Acción realizada  |
| `module`     | text      | Módulo            |
| `entity_id`  | text      | ID de la entidad  |
| `old_data`   | jsonb     | Datos anteriores  |
| `new_data`   | jsonb     | Datos nuevos      |
| `ip_address` | text      | Dirección IP      |
| `user_agent` | text      | User Agent        |
| `created_at` | timestamp | Fecha de creación |

#### notifications

| Campo        | Tipo      | Descripción       |
| ------------ | --------- | ----------------- |
| `id`         | uuid      | ID único          |
| `user_id`    | uuid      | ID del usuario    |
| `title`      | text      | Título            |
| `body`       | text      | Cuerpo            |
| `type`       | text      | Tipo              |
| `is_read`    | boolean   | Leída             |
| `data`       | text      | Datos adicionales |
| `created_at` | timestamp | Fecha de creación |

---

## API Endpoints

Todos los endpoints tienen el prefijo `/api/v1`.

### Autenticación

| Método | Endpoint              | Descripción        | Acceso  |
| ------ | --------------------- | ------------------ | ------- |
| POST   | /auth/login           | Iniciar sesión     | Público |
| POST   | /auth/refresh         | Refrescar sesión   | Público |
| POST   | /auth/logout          | Cerrar sesión      | Privado |
| POST   | /auth/register        | Registrar usuario  | Admin   |
| POST   | /auth/change-password | Cambiar contraseña | Privado |

`/auth/logout` revoca sesiones/refresh tokens en Supabase con scope global; los access tokens existentes pueden seguir vigentes hasta expirar. `/auth/change-password` verifica la contraseña actual y actualiza la nueva contraseña con Supabase Admin.

### Usuarios

| Método | Endpoint         | Descripción        | Acceso  |
| ------ | ---------------- | ------------------ | ------- |
| GET    | /users/me        | Perfil actual      | Privado |
| PATCH  | /users/me/avatar | Actualizar avatar  | Privado |
| DELETE | /users/me/avatar | Eliminar avatar    | Privado |
| GET    | /users           | Listar usuarios    | Admin   |
| POST   | /users           | Crear usuario operativo o con Auth | Admin |
| GET    | /users/:id       | Usuario por ID     | Admin   |
| POST   | /users/:id/auth-account | Vincular cuenta Auth | Admin |
| PATCH  | /users/:id       | Actualizar usuario | Privado |
| DELETE | /users/:id       | Eliminar usuario   | Admin   |

En `PATCH /users/:id`, un usuario solo puede actualizar sus campos de perfil (`firstName`, `lastName`, `phone`, `dni`, `address`, `bank`, `bankAccounts`, `maritalStatus`). Owner puede gestionar cualquier usuario. Admin no owner puede gestionar usuarios no administradores y también puede actualizar `email` y `active` donde aplique. El rol no se puede modificar y `isOwner` no se asigna ni modifica por endpoints.

### Solicitudes de Acceso

| Método | Endpoint                    | Descripción        | Acceso  |
| ------ | --------------------------- | ------------------ | ------- |
| POST   | /access-requests            | Crear solicitud    | Público |
| GET    | /access-requests            | Listar solicitudes | Admin   |
| GET    | /access-requests/:id        | Solicitud por ID   | Admin   |
| PATCH  | /access-requests/:id/status | Actualizar estado  | Admin   |

### Préstamos

| Método | Endpoint                | Descripción        | Acceso  |
| ------ | ----------------------- | ------------------ | ------- |
| POST   | /loans                  | Crear préstamo     | Admin   |
| GET    | /loans                  | Listar préstamos   | Privado |
| GET    | /loans/summary          | Resumen financiero | Privado |
| GET    | /loans/:id              | Préstamo por ID    | Privado |
| GET    | /loans/:id/installments | Cronograma         | Privado |
| PATCH  | /loans/:id/approve      | Aprobar préstamo   | Privado |
| PATCH  | /loans/:id/reject       | Rechazar préstamo  | Privado |

### Pagos

| Método | Endpoint               | Descripción        | Acceso  |
| ------ | ---------------------- | ------------------ | ------- |
| POST   | /payments              | Registrar pago     | Admin   |
| GET    | /payments/loan/:loanId | Pagos por préstamo | Privado |

Los pagos se aplican a cuotas `pending` y `overdue` por fecha de vencimiento. El backend rechaza pagos excedentes con 400 y marca el préstamo como `paid` cuando todas sus cuotas quedan pagadas. `POST /payments` acepta JSON o `multipart/form-data` con imagen opcional en el campo `evidence`.

### Vouchers

Si el préstamo no tiene inversionista con cuenta de acceso activa, el voucher entra directamente en `pending_admin_review`. Si el inversionista sí puede autenticarse, entra en `pending_investor_review` y luego pasa a validación administrativa. El cliente no escoge método de pago en vouchers; cuando administración aprueba, el pago se registra internamente con `method = transfer`.

| Método | Endpoint                              | Descripción           | Acceso          |
| ------ | ------------------------------------- | --------------------- | --------------- |
| POST   | /payment-vouchers/analyze             | Analizar OCR          | Client          |
| POST   | /payment-vouchers                     | Subir voucher         | Client          |
| GET    | /payment-vouchers                     | Listar vouchers       | Privado         |
| GET    | /payment-vouchers/operation-id/exists | Verificar operationId | Client          |
| PATCH  | /payment-vouchers/:id/process         | Procesar voucher      | Admin, Investor |

### Notificaciones

| Método | Endpoint                | Descripción           | Acceso  |
| ------ | ----------------------- | --------------------- | ------- |
| GET    | /notifications          | Listar notificaciones | Privado |
| PATCH  | /notifications/read-all | Marcar todas leídas   | Privado |
| PATCH  | /notifications/:id/read | Marcar leída          | Privado |

`GET /notifications` soporta `isRead=true|false`, `page` y `limit` (max 50). La respuesta incluye `meta.page`, `meta.limit`, `meta.total`, `meta.totalPages` y `meta.unreadCount`.

### Reportes

| Método | Endpoint           | Descripción            | Acceso          |
| ------ | ------------------ | ---------------------- | --------------- |
| GET    | /reports/statement | Estado de cuenta       | Admin, Client   |
| GET    | /reports/portfolio | Portafolio inversiones | Admin, Investor |
| GET    | /reports/dashboard | Dashboard admin        | Admin           |

### Auditoría

| Método | Endpoint    | Descripción | Acceso |
| ------ | ----------- | ----------- | ------ |
| GET    | /audit-logs | Listar logs | Admin  |

---

## Configuración

### Variables de Entorno

| Variable                         | Tipo    | Descripción       | Default             |
| -------------------------------- | ------- | ----------------- | ------------------- |
| `NODE_ENV`                       | string  | Entorno           | development         |
| `PORT`                           | number  | Puerto            | 3000                |
| `APP_NAME`                       | string  | Nombre de app     | abc-inversiones-api |
| `APP_TIMEZONE`                   | string  | Zona horaria      | UTC                 |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | number  | TTL de URLs       | 900                 |
| `OCR_ENABLED`                    | boolean | OCR habilitado    | true                |
| `OCR_PROVIDER`                   | string  | Proveedor OCR     | google-vision       |
| `SUPABASE_URL`                   | string  | URL de Supabase   | -                   |
| `SUPABASE_ANON_KEY`              | string  | Anon key          | -                   |
| `SUPABASE_SERVICE_ROLE_KEY`      | string  | Service role key  | -                   |
| `DATABASE_URL`                   | string  | URL de PostgreSQL | -                   |

---

## Scripts

| Comando              | Descripción           |
| -------------------- | --------------------- |
| `pnpm dev`           | Iniciar en desarrollo |
| `pnpm build`         | Compilar              |
| `pnpm start`         | Iniciar producción    |
| `pnpm typecheck`     | Verificar tipos       |
| `pnpm test`          | Ejecutar pruebas      |
| `pnpm db:push`       | Aplicar esquema       |
| `pnpm db:seed`       | Sembrar datos         |
| `pnpm db:seed:api`   | Sembrar mediante API  |
| `pnpm setup:storage` | Configurar storage    |

---

## Seguridad

- Autenticación vía Supabase Auth
- Autorización por roles en cada endpoint
- Row Level Security (RLS) en todas las tablas
- Índices únicos para evitar duplicados
- Logging estructurado con Pino
- Error handling global
- Validación de MIME types en uploads (JPEG, PNG, WebP)
- Límite de tamaño por endpoint (1.5MB OCR, 5MB vouchers/avatars)

### Respuesta Estándar

Todas las respuestas siguen el siguiente formato:

```json
{
  "success": true,
  "message": "Mensaje descriptivo",
  "data": {},
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

---

## Links

- [Documentación de Endpoints](./docs/endpoints/)
- [Configuración](./docs/config/)

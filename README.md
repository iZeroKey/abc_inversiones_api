# ABC Inversiones API

Backend de ABC Inversiones para la gestión de usuarios, solicitudes de acceso, prestamos, cuotas, pagos, vouchers, auditoria, notificaciones y reportes.

## Tabla de Contenidos

1. [Informacion General](#informacion-general)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Arquitectura](#arquitectura)
4. [Roles y Permisos](#roles-y-permisos)
5. [Modelo de Datos](#modelo-de-datos)
6. [API Endpoints](#api-endpoints)
7. [Configuracion](#configuracion)
8. [Scripts](#scripts)
9. [Seguridad](#seguridad)

---

## Informacion General

- **Empresa**: ABC Inversiones S.A.C.
- **Nombre del proyecto**: abc-inversiones-api
- **Version**: 1.0.0
- **Tipo**: API RESTful

ABC Inversiones es una plataforma de gestión de prestamos que permite:

- Autenticacion y control de acceso por roles
- Gestion de solicitudes de acceso de clientes e inversionistas
- Creacion y seguimiento de prestamos
- Generación automatica de cuotas
- Registro y validacion de pagos
- Carga de vouchers con flujo derevision
- OCR asistido para prellenado de formularios
- Auditoria de acciones sensibles
- Notificaciones internas
- Reportes operativos

---

## Stack Tecnologico

- **Runtime**: Node.js
- **Lenguaje**: TypeScript
- **Framework**: Express
- **ORM**: Drizzle ORM
- **Base de datos**: PostgreSQL (Supabase)
- **Autenticacion**: Supabase Auth
- **Almacenamiento**: Supabase Storage
- **OCR**: Google Cloud Vision API
- **Logging**: Pino

---

## Arquitectura

```
src/
├── config/
├── db/
│   └── schema/
├── middleware/
├── modules/
├── routes/
├── scripts/
├── utils/
└── realtime/
```

- `config/`: Configuraciones de la aplicación, incluyendo la conexión a la base de datos, variables de entorno y logger
- `db/schema/`: Esquemas de la base de datos definidos con Drizzle ORM
- `middleware/`: Middlewares personalizados para autenticación, autorización, manejo de errores, etc
- `modules/`: Lógica de negocio organizada por módulos (usuarios, prestamos, pagos, vouchers, etc.)
- `routes/`: Definición de rutas y endpoints de la API
- `scripts/`: Scripts para tareas de mantenimiento, migraciones, seeders, etc
- `utils/`: Funciones utilitarias y helpers
- `realtime/`: Implementación de WebSocket para notificaciones en tiempo real

---

## Roles y Permisos

| Rol        | Descripcion   | Permisos                            |
| ---------- | ------------- | ----------------------------------- |
| `admin`    | Administrador | Acceso total a todos los modulos    |
| `owner`    | Dueño         | Acceso total (similar a admin)      |
| `client`   | Cliente       | Ver sus prestamos, subir vouchers   |
| `investor` | Inversionista | Ver sus prestamos, revisar vouchers |

### Flujo de Validacion

1. **Cliente**: Solo ve sus propios prestamos y vouchers
2. **Inversionista**: Ve prestamos asignados, puede aprobar/rechazar vouchers preliminarmente
3. **Admin/Owner**: Acceso total, validacion final de vouchers

---

## Modelo de Datos

### Tablas

| Tabla              | Descripcion           |
| ------------------ | --------------------- |
| `users`            | Usuarios registrados  |
| `access_requests`  | Solicitudes de acceso |
| `loans`            | Prestamos             |
| `installments`     | Cuotas de prestamos   |
| `payments`         | Pagos registrados     |
| `payment_vouchers` | Vouchers de pago      |
| `audit_logs`       | Log de auditoria      |
| `notifications`    | Notificaciones        |

### Detalles de Tablas

#### users

| Campo        | Tipo       | Descripcion              |
| ------------ | ---------- | ------------------------ |
| `id`         | text(UUID) | ID unico (Supabase Auth) |
| `first_name` | text       | Nombres                  |
| `last_name`  | text       | Apellidos                |
| `email`      | text       | Correo electronico       |
| `phone`      | text       | Telefono                 |
| `avatar_url` | text       | URL del avatar           |
| `role`       | enum       | admin, client, investor  |
| `is_owner`   | boolean    | Es propietario           |
| `active`     | boolean    | Esta activo              |
| `created_at` | timestamp  | Fecha de creacion        |
| `updated_at` | timestamp  | Fecha de actualizacion   |
| `deleted_at` | timestamp  | Fecha de eliminacion     |

#### access_requests

| Campo             | Tipo      | Descripcion                            |
| ----------------- | --------- | -------------------------------------- |
| `id`              | uuid      | ID unico                               |
| `email`           | text      | Correo solicitante                     |
| `first_name`      | text      | Nombres                                |
| `last_name`       | text      | Apellidos                              |
| `phone`           | text      | Telefono                               |
| `role_requested`  | enum      | client, investor                       |
| `status`          | enum      | pending, in_review, approved, rejected |
| `additional_data` | jsonb     | Datos adicionales                      |
| `observation`     | text      | Observacion                            |
| `created_at`      | timestamp | Fecha de creacion                      |
| `updated_at`      | timestamp | Fecha de actualizacion                 |

#### loans

| Campo                | Tipo      | Descripcion                                                                             |
| -------------------- | --------- | --------------------------------------------------------------------------------------- |
| `id`                 | uuid      | ID unico                                                                                |
| `client_id`          | text      | ID del cliente                                                                          |
| `investor_id`        | text      | ID del inversionista                                                                    |
| `principal`          | numeric   | Monto principal                                                                         |
| `interest_rate`      | numeric   | Tasa de interes                                                                         |
| `interest_type`      | enum      | simple, compound                                                                        |
| `interest_period`    | enum      | monthly, annual                                                                         |
| `installments_count` | integer   | Numero de cuotas                                                                        |
| `frequency`          | enum      | daily, weekly, biweekly, monthly                                                        |
| `payment_day`        | integer   | Dia de pago                                                                             |
| `total_debt`         | numeric   | Deuda total                                                                             |
| `status`             | enum      | draft, pending_investor_review, pending_admin_review, active, rejected, paid, defaulted |
| `is_company_funded`  | boolean   | financiado por empresa                                                                  |
| `start_date`         | timestamp | Fecha de inicio                                                                         |
| `observation`        | text      | Observacion                                                                             |
| `created_at`         | timestamp | Fecha de creacion                                                                       |
| `updated_at`         | timestamp | Fecha de actualizacion                                                                  |

#### installments

| Campo                | Tipo      | Descripcion            |
| -------------------- | --------- | ---------------------- |
| `id`                 | uuid      | ID unico               |
| `loan_id`            | uuid      | ID del prestamo        |
| `installment_number` | integer   | Numero de cuota        |
| `due_date`           | timestamp | Fecha de vencimiento   |
| `amount`             | numeric   | Monto de la cuota      |
| `paid_amount`        | numeric   | Monto pagado           |
| `status`             | enum      | pending, paid, overdue |
| `created_at`         | timestamp | Fecha de creacion      |
| `updated_at`         | timestamp | Fecha de actualizacion |

#### payments

| Campo              | Tipo      | Descripcion                    |
| ------------------ | --------- | ------------------------------ |
| `id`               | uuid      | ID unico                       |
| `loan_id`          | uuid      | ID del prestamo                |
| `installment_id`   | uuid      | ID de la cuota                 |
| `amount`           | numeric   | Monto del pago                 |
| `payment_date`     | timestamp | Fecha del pago                 |
| `method`           | enum      | cash, transfer, deposit, other |
| `reference`        | text      | Referencia                     |
| `observation`      | text      | Observacion                    |
| `registered_by_id` | text      | ID de quien registra           |
| `status`           | enum      | confirmed, reversed            |
| `created_at`       | timestamp | Fecha de creacion              |
| `updated_at`       | timestamp | Fecha de actualizacion         |

#### payment_vouchers

| Campo             | Tipo      | Descripcion                                                                                          |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `id`              | uuid      | ID unico                                                                                             |
| `loan_id`         | uuid      | ID del prestamo                                                                                      |
| `client_id`       | text      | ID del cliente                                                                                       |
| `amount`          | numeric   | Monto del voucher                                                                                    |
| `operation_id`    | text      | ID de operacion bancaria                                                                             |
| `operation_date`  | timestamp | Fecha de operacion                                                                                   |
| `evidence_url`    | text      | URL de la evidencia                                                                                  |
| `status`          | enum      | draft, pending_investor_review, investor_approved, investor_rejected, owner_approved, owner_rejected |
| `observation`     | text      | Observacion                                                                                          |
| `processed_by_id` | text      | ID de quien proceso                                                                                  |
| `created_at`      | timestamp | Fecha de creacion                                                                                    |
| `updated_at`      | timestamp | Fecha de actualizacion                                                                               |

#### audit_logs

| Campo        | Tipo      | Descripcion       |
| ------------ | --------- | ----------------- |
| `id`         | uuid      | ID unico          |
| `user_id`    | text      | ID del usuario    |
| `action`     | text      | Accion realizada  |
| `module`     | text      | Modulo            |
| `entity_id`  | text      | ID de la entidad  |
| `old_data`   | jsonb     | Datos anteriores  |
| `new_data`   | jsonb     | Datos nuevos      |
| `ip_address` | text      | Direccion IP      |
| `user_agent` | text      | User Agent        |
| `created_at` | timestamp | Fecha de creacion |

#### notifications

| Campo        | Tipo      | Descripcion       |
| ------------ | --------- | ----------------- |
| `id`         | uuid      | ID unico          |
| `user_id`    | text      | ID del usuario    |
| `title`      | text      | Titulo            |
| `body`       | text      | Cuerpo            |
| `type`       | text      | Tipo              |
| `is_read`    | boolean   | Leida             |
| `data`       | text      | Datos adicionales |
| `created_at` | timestamp | Fecha de creacion |

---

## API Endpoints

Todos los endpoints tienen el prefijo `/api/v1`.

### Autenticacion

| Metodo | Endpoint              | Descripcion        | Acceso  |
| ------ | --------------------- | ------------------ | ------- |
| POST   | /auth/login           | Iniciar sesion     | Publico |
| POST   | /auth/logout          | Cerrar sesion      | Privado |
| POST   | /auth/register        | Registrar usuario  | Admin   |
| POST   | /auth/change-password | Cambiar contrasena | Privado |

### Usuarios

| Metodo | Endpoint         | Descripcion        | Acceso  |
| ------ | ---------------- | ------------------ | ------- |
| GET    | /users/me        | Perfil actual      | Privado |
| PATCH  | /users/me/avatar | Actualizar avatar  | Privado |
| GET    | /users           | Listar usuarios    | Admin   |
| GET    | /users/:id       | Usuario por ID     | Admin   |
| PATCH  | /users/:id       | Actualizar usuario | Privado |
| DELETE | /users/:id       | Eliminar usuario   | Admin   |

### Solicitudes de Acceso

| Metodo | Endpoint                    | Descripcion        | Acceso  |
| ------ | --------------------------- | ------------------ | ------- |
| POST   | /access-requests            | Crear solicitud    | Publico |
| GET    | /access-requests            | Listar solicitudes | Admin   |
| GET    | /access-requests/:id        | Solicitud por ID   | Admin   |
| PATCH  | /access-requests/:id/status | Actualizar estado  | Admin   |

### Prestamos

| Metodo | Endpoint                | Descripcion        | Acceso  |
| ------ | ----------------------- | ------------------ | ------- |
| POST   | /loans                  | Crear prestamo     | Admin   |
| GET    | /loans                  | Listar prestamos   | Privado |
| GET    | /loans/summary          | Resumen financiero | Privado |
| GET    | /loans/:id              | Prestamo por ID    | Privado |
| GET    | /loans/:id/installments | Cronograma         | Privado |
| PATCH  | /loans/:id/approve      | Aprobar prestamo   | Privado |
| PATCH  | /loans/:id/reject       | Rechazar prestamo  | Privado |

### Pagos

| Metodo | Endpoint               | Descripcion        | Acceso  |
| ------ | ---------------------- | ------------------ | ------- |
| POST   | /payments              | Registrar pago     | Admin   |
| GET    | /payments/loan/:loanId | Pagos por prestamo | Privado |

### Vouchers

| Metodo | Endpoint                              | Descripcion           | Acceso          |
| ------ | ------------------------------------- | --------------------- | --------------- |
| POST   | /payment-vouchers/analyze             | Analizar OCR          | Client          |
| POST   | /payment-vouchers                     | Subir voucher         | Client          |
| GET    | /payment-vouchers                     | Listar vouchers       | Privado         |
| GET    | /payment-vouchers/operation-id/exists | Verificar operationId | Client          |
| PATCH  | /payment-vouchers/:id/process         | Procesar voucher      | Admin, Investor |

### Notificaciones

| Metodo | Endpoint                | Descripcion           | Acceso  |
| ------ | ----------------------- | --------------------- | ------- |
| GET    | /notifications          | Listar notificaciones | Privado |
| PATCH  | /notifications/read-all | Marcar todas leidas   | Privado |
| PATCH  | /notifications/:id/read | Marcar leida          | Privado |

### Reportes

| Metodo | Endpoint           | Descripcion            | Acceso          |
| ------ | ------------------ | ---------------------- | --------------- |
| GET    | /reports/statement | Estado de cuenta       | Admin, Client   |
| GET    | /reports/portfolio | Portafolio inversiones | Admin, Investor |
| GET    | /reports/dashboard | Dashboard admin        | Admin           |

### Auditoria

| Metodo | Endpoint    | Descripcion | Acceso |
| ------ | ----------- | ----------- | ------ |
| GET    | /audit-logs | Listar logs | Admin  |

---

## Configuracion

### Variables de Entorno

| Variable                         | Tipo    | Descripcion       | Default             |
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

| Comando              | Descripcion           |
| -------------------- | --------------------- |
| `pnpm dev`           | Iniciar en desarrollo |
| `pnpm build`         | Compilar              |
| `pnpm start`         | Iniciar produccion    |
| `pnpm typecheck`     | Verificar tipos       |
| `pnpm test`          | Ejecutar pruebas      |
| `pnpm db:push`       | Aplicar esquema       |
| `pnpm db:seed`       | Sembrar datos         |
| `pnpm setup:storage` | Configurar storage    |

---

## Seguridad

- Autenticacion via Supabase Auth
- Autorizacion por roles en cada endpoint
- Row Level Security (RLS) en todas las tablas
- Indices unicos para evitar duplicados
- Logging estructurado con Pino
- Error handling global

### Respuesta Estandar

Todas las respuestasfollowan el siguiente formato:

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

- [Documentacion de Endpoints](./endpoints/)
- [Configuracion](./docs/config/)

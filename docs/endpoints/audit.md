# Auditoría

## Tabla de Contenidos

1. [Get Audit Logs](#get-audit-logs)
2. [Get Audit Logs by User](#get-audit-logs-by-user)

---

## Get Audit Logs

Listar logs de auditoría global con filtros y paginación.

### Endpoint

```
GET /api/v1/audit-logs
```

### Acceso

Privado (Admin)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo  | Tipo   | Obligatorio | Descripción                                          |
| ------ | ------ | ----------- | ---------------------------------------------------- |
| userId | uuid   | No          | Filtrar por ID de usuario                            |
| action | string | No          | Filtrar por nombre de acción                         |
| module | string | No          | Filtrar por módulo (p. ej. `LOANS`, `VOUCHERS`, etc) |
| from   | string | No          | Filtrar por fecha de creación inicial (ISO8601)      |
| to     | string | No          | Filtrar por fecha de creación final (ISO8601)        |
| page   | number | No          | Número de página, default 1                          |
| limit  | number | No          | Límite de elementos por página, default 50, max 200  |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Logs de auditoría obtenidos",
  "data": [
    {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "userId": "uuid-user-id",
      "action": "SUBMIT_VOUCHER",
      "module": "VOUCHERS",
      "entityId": "uuid-voucher-id",
      "oldData": null,
      "newData": {
        "id": "uuid-voucher-id",
        "amount": "500.00"
      },
      "ipAddress": "127.0.0.1",
      "userAgent": "PostmanRuntime/7.40.0",
      "createdAt": "2026-05-22T04:30:00.000Z",
      "user": {
        "id": "uuid-user-id",
        "publicCode": "US-00001",
        "firstName": "Juan",
        "lastName": "Pérez",
        "email": "juan.perez@example.com",
        "phone": "+51999999999",
        "dni": "12345678",
        "role": "client",
        "active": true,
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      }
    }
  ],
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z",
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                 |
| ------ | --------------------------- |
| 200    | Logs de auditoría obtenidos |
| 401    | No autorizado               |
| 403    | Rol insuficiente (no Admin) |
| 500    | Error interno               |

---

## Get Audit Logs by User

Obtener el historial de los últimos 100 logs de auditoría de un usuario específico.

### Endpoint

```
GET /api/v1/audit-logs/user/:userId
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción              |
| --------- | ---- | ------------------------ |
| userId    | uuid | ID del usuario a filtrar |

### Acceso

Privado (Admin)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Logs del usuario obtenidos",
  "data": [
    {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "userId": "uuid-user-id",
      "action": "SUBMIT_VOUCHER",
      "module": "VOUCHERS",
      "entityId": "uuid-voucher-id",
      "oldData": null,
      "newData": {
        "id": "uuid-voucher-id",
        "amount": "500.00"
      },
      "ipAddress": "127.0.0.1",
      "userAgent": "PostmanRuntime/7.40.0",
      "createdAt": "2026-05-22T04:30:00.000Z",
      "user": {
        "id": "uuid-user-id",
        "publicCode": "US-00001",
        "firstName": "Juan",
        "lastName": "Pérez",
        "email": "juan.perez@example.com",
        "phone": "+51999999999",
        "dni": "12345678",
        "role": "client",
        "active": true,
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      }
    }
  ],
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                 |
| ------ | --------------------------- |
| 200    | Logs del usuario obtenidos  |
| 401    | No autorizado               |
| 403    | Rol insuficiente (no Admin) |
| 500    | Error interno               |

---

### Acciones Comunes

| Acción                  | Descripción                         |
| ----------------------- | ----------------------------------- |
| SUBMIT_ACCESS_REQUEST   | Enviar solicitud de acceso          |
| PROCESS_ACCESS_REQUEST  | Procesar solicitud de acceso        |
| REGISTER_USER           | Registrar usuario inicial           |
| LINK_AUTH_ACCOUNT       | Vincular cuenta de acceso           |
| UPDATE_USER_PROFILE     | Actualizar perfil de usuario        |
| UPDATE_USER_AVATAR      | Actualizar avatar de usuario        |
| DELETE_USER_AVATAR      | Eliminar avatar de usuario          |
| DEACTIVATE_USER         | Desactivar usuario                  |
| CREATE_LOAN             | Crear préstamo                      |
| UPDATE_LOAN             | Actualizar préstamo                 |
| APPROVE_LOAN_INVESTOR   | Aprobar préstamo como inversionista |
| APPROVE_LOAN_ADMIN      | Activar préstamo como admin         |
| REJECT_LOAN             | Rechazar préstamo                   |
| DELETE_LOAN             | Eliminar préstamo                   |
| SUBMIT_VOUCHER          | Subir voucher                       |
| PROCESS_VOUCHER_APPROVE | Procesar aprobación de voucher      |
| PROCESS_VOUCHER_REJECT  | Procesar rechazo de voucher         |
| UPDATE_VOUCHER          | Actualizar voucher                  |
| DELETE_VOUCHER          | Eliminar voucher                    |
| REGISTER_PAYMENT        | Registrar pago manual               |
| UPDATE_PAYMENT          | Actualizar pago manual              |
| DELETE_PAYMENT          | Eliminar pago manual                |
| CHANGE_PASSWORD         | Cambiar contraseña                  |

# Access Requests

## Tabla de Contenidos

1. [Create Request](#create-request)
2. [Get All Requests](#get-all-requests)
3. [Get Request By ID](#get-request-by-id)
4. [Update Status](#update-status)

---

## Create Request

Enviar una nueva solicitud de acceso a la plataforma.

### Endpoint

```
POST /api/v1/access-requests
```

### Acceso

Público

### Encabezados

| Encabezado   | Valor            | Obligatorio |
| ------------ | ---------------- | ----------- |
| Content-Type | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "roleRequested": "client | investor",
  "additionalData": {}
}
```

### Diccionario de Datos

| Campo          | Tipo   | Obligatorio | Descripción        | Restricciones         |
| -------------- | ------ | ----------- | ------------------ | --------------------- |
| email          | string | Sí          | Correo electrónico | Debe ser email válido |
| firstName      | string | Sí          | Nombres            | Mínimo 2 caracteres   |
| lastName       | string | Sí          | Apellidos          | Mínimo 2 caracteres   |
| phone          | string | Sí          | Teléfono           | Mínimo 7 caracteres   |
| roleRequested  | enum   | Sí          | Rol solicitado     | client o investor     |
| additionalData | object | No          | Datos adicionales  | -                     |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitud creada exitosamente",
  "data": {
    "id": "uuid",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "roleRequested": "client",
    "status": "pending"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción      |
| ------ | ---------------- |
| 201    | Solicitud creada |
| 400    | Datos inválidos  |
| 500    | Error interno    |

---

## Get All Requests

Listar todas las solicitudes de acceso.

### Endpoint

```
GET /api/v1/access-requests
```

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo  | Tipo   | Descripción        |
| ------ | ------ | ------------------ |
| status | string | Filtrar por estado |
| page   | number | Número de página   |
| limit  | number | Límite por página  |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitudes obtenidas",
  "data": [
    {
      "id": "uuid",
      "email": "email@example.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "phone": "+51 999 999 999",
      "roleRequested": "client",
      "status": "pending",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z",
    "pagination": {...}
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 200    | Solicitudes obtenidas |
| 401    | No autorizado         |
| 500    | Error interno         |

---

## Get Request By ID

Obtener el detalle completo de una solicitud de acceso específica.

### Endpoint

```
GET /api/v1/access-requests/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción        |
| --------- | ---- | ------------------ |
| id        | uuid | ID de la solicitud |

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitud obtenida",
  "data": {
    "id": "uuid",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+51 999 999 999",
    "roleRequested": "client",
    "status": "pending",
    "additionalData": {},
    "observation": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción             |
| ------ | ----------------------- |
| 200    | Solicitud obtenida      |
| 401    | No autorizado           |
| 404    | Solicitud no encontrada |
| 500    | Error interno           |

---

## Update Status

Actualizar el estado de una solicitud. Si se aprueba, crea el usuario automáticamente.

### Endpoint

```
PATCH /api/v1/access-requests/:id/status
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción        |
| --------- | ---- | ------------------ |
| id        | uuid | ID de la solicitud |

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "status": "pending | in_review | approved | rejected",
  "observation": "string",
  "initialPassword": "string"
}
```

### Diccionario de Datos

| Campo           | Tipo   | Obligatorio | Descripción        | Restricciones                          |
| --------------- | ------ | ----------- | ------------------ | -------------------------------------- |
| status          | enum   | Sí          | Nuevo estado       | pending, in_review, approved, rejected |
| observation     | string | No          | Observación        | -                                      |
| initialPassword | string | No          | Contraseña inicial | Mínimo 6 caracteres                    |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitud actualizada",
  "data": {
    "id": "uuid",
    "status": "approved",
    "observation": "Aprobado",
    "userId": "uuid"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción             |
| ------ | ----------------------- |
| 200    | Solicitud actualizada   |
| 400    | Datos inválidos         |
| 401    | No autorizado           |
| 404    | Solicitud no encontrada |
| 500    | Error interno           |

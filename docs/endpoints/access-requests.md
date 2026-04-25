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

Publico

### Encabezados

| Encabezado   | Valor            | Obligatorio |
| ------------ | ---------------- | ----------- |
| Content-Type | application/json | Si          |

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

| Campo          | Tipo   | Obligatorio | Descripcion        | Restricciones         |
| -------------- | ------ | ----------- | ------------------ | --------------------- |
| email          | string | Si          | Correo electronico | Debe ser email valido |
| firstName      | string | Si          | Nombres            | Minimo 2 caracteres   |
| lastName       | string | Si          | Apellidos          | Minimo 2 caracteres   |
| phone          | string | Si          | Telefono           | Minimo 7 caracteres   |
| roleRequested  | enum   | Si          | Rol solicitado     | client o investor     |
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
    "lastName": "Perez",
    "roleRequested": "client",
    "status": "pending"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion      |
| ------ | ---------------- |
| 201    | Solicitud creada |
| 400    | Datos invalidos  |
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
| Authorization | Bearer {token} | Si          |

### Parametros de Consulta

| Campo  | Tipo   | Descripcion        |
| ------ | ------ | ------------------ |
| status | string | Filtrar por estado |
| page   | number | Numero de pagina   |
| limit  | number | Limite por pagina  |

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
      "lastName": "Perez",
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

| Codigo | Descripcion           |
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

### Parametros de Ruta

| Parametro | Tipo | Descripcion        |
| --------- | ---- | ------------------ |
| id        | uuid | ID de la solicitud |

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitud obtenida",
  "data": {
    "id": "uuid",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
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

| Codigo | Descripcion             |
| ------ | ----------------------- |
| 200    | Solicitud obtenida      |
| 401    | No autorizado           |
| 404    | Solicitud no encontrada |
| 500    | Error interno           |

---

## Update Status

Actualizar el estado de una solicitud. Si se aprueba, crea el usuario automaticamente.

### Endpoint

```
PATCH /api/v1/access-requests/:id/status
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion        |
| --------- | ---- | ------------------ |
| id        | uuid | ID de la solicitud |

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Si          |
| Content-Type  | application/json | Si          |

### Cuerpo de Solicitud

```json
{
  "status": "pending | in_review | approved | rejected",
  "observation": "string",
  "initialPassword": "string"
}
```

### Diccionario de Datos

| Campo           | Tipo   | Obligatorio | Descripcion        | Restricciones                          |
| --------------- | ------ | ----------- | ------------------ | -------------------------------------- |
| status          | enum   | Si          | Nuevo estado       | pending, in_review, approved, rejected |
| observation     | string | No          | Observacion        | -                                      |
| initialPassword | string | No          | Contrasena inicial | Minimo 6 caracteres                    |

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

| Codigo | Descripcion             |
| ------ | ----------------------- |
| 200    | Solicitud actualizada   |
| 400    | Datos invalidos         |
| 401    | No autorizado           |
| 404    | Solicitud no encontrada |
| 500    | Error interno           |

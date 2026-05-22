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

Público (Anónimo)

### Encabezados

| Encabezado   | Valor            | Obligatorio |
| ------------ | ---------------- | ----------- |
| Content-Type | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "email": "juan.perez@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+51999999999",
  "roleRequested": "client",
  "additionalData": {
    "referredBy": "CL-00002"
  }
}
```

### Diccionario de Datos

| Campo          | Tipo   | Obligatorio | Descripción                               | Restricciones                           |
| -------------- | ------ | ----------- | ----------------------------------------- | --------------------------------------- |
| email          | string | Sí          | Correo electrónico de contacto.           | Debe ser una dirección de email válida. |
| firstName      | string | Sí          | Nombres del solicitante.                  | Mínimo 2 caracteres.                    |
| lastName       | string | Sí          | Apellidos del solicitante.                | Mínimo 2 caracteres.                    |
| phone          | string | Sí          | Número de teléfono.                       | Mínimo 7 caracteres.                    |
| roleRequested  | enum   | Sí          | Rol solicitado para ingresar.             | Permite `"client"` o `"investor"`.      |
| additionalData | object | No          | Objeto clave-valor con datos adicionales. | Default: `{}`.                          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitud enviada correctamente",
  "data": {
    "id": "18f9e612-4fb3-4876-b333-e99d91f21db5",
    "email": "juan.perez@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+51999999999",
    "roleRequested": "client",
    "status": "pending",
    "additionalData": {
      "referredBy": "CL-00002"
    },
    "observation": null,
    "createdAt": "2026-05-22T04:26:00.000Z",
    "updatedAt": "2026-05-22T04:26:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                     |
| ------ | ------------------------------- |
| 201    | Solicitud enviada correctamente |
| 400    | Datos inválidos                 |
| 500    | Error interno                   |

---

## Get All Requests

Listar todas las solicitudes de acceso ordenadas por fecha de creación descendente. Este endpoint no implementa paginación ni filtros de consulta.

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

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitudes obtenidas",
  "data": [
    {
      "id": "18f9e612-4fb3-4876-b333-e99d91f21db5",
      "email": "juan.perez@example.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "phone": "+51999999999",
      "roleRequested": "client",
      "status": "pending",
      "additionalData": {
        "referredBy": "CL-00002"
      },
      "observation": null,
      "createdAt": "2026-05-22T04:26:00.000Z",
      "updatedAt": "2026-05-22T04:26:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 200    | Solicitudes obtenidas |
| 401    | No autenticado        |
| 403    | No autorizado         |
| 500    | Error interno         |

---

## Get Request By ID

Obtener el detalle completo de una solicitud de acceso por su ID (UUID).

### Endpoint

```
GET /api/v1/access-requests/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                   |
| --------- | ---- | ----------- | ----------------------------- |
| id        | uuid | Sí          | UUID de la solicitud a buscar |

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
    "id": "18f9e612-4fb3-4876-b333-e99d91f21db5",
    "email": "juan.perez@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+51999999999",
    "roleRequested": "client",
    "status": "pending",
    "additionalData": {
      "referredBy": "CL-00002"
    },
    "observation": null,
    "createdAt": "2026-05-22T04:26:00.000Z",
    "updatedAt": "2026-05-22T04:26:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción             |
| ------ | ----------------------- |
| 200    | Solicitud obtenida      |
| 401    | No autenticado          |
| 403    | No autorizado           |
| 404    | Solicitud no encontrada |
| 500    | Error interno           |

---

## Update Status

Actualizar el estado de una solicitud de acceso (`pending`, `in_review`, `approved`, `rejected`).

### Reglas de Negocio

- Si se actualiza el estado a `approved`, se creará automáticamente una cuenta en Supabase Auth y un usuario local vinculado con el rol solicitado y un código público autogenerado. Para esto, es **obligatorio** enviar la contraseña inicial a través de `initialPassword`.
- Si la solicitud ya fue previamente aprobada, el endpoint rechazará modificaciones posteriores con un error `400`.

### Endpoint

```
PATCH /api/v1/access-requests/:id/status
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                      |
| --------- | ---- | ----------- | -------------------------------- |
| id        | uuid | Sí          | UUID de la solicitud a procesar. |

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Content-Type  | application/json | Sí          |
| Authorization | Bearer {token}   | Sí          |

### Cuerpo de Solicitud

**Ejemplo Aprobando Solicitud:**

```json
{
  "status": "approved",
  "observation": "Usuario verificado por teléfono",
  "initialPassword": "passwordTemporal123"
}
```

**Ejemplo Rechazando o Cambiando a otro Estado:**

```json
{
  "status": "rejected",
  "observation": "No cumple con los requisitos del perfil"
}
```

### Diccionario de Datos

| Campo           | Tipo   | Obligatorio                         | Descripción                                                                      | Restricciones                                  |
| --------------- | ------ | ----------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| status          | enum   | Sí                                  | Nuevo estado para la solicitud.                                                  | `approved`, `pending`, `in_review`, `rejected` |
| observation     | string | No                                  | Nota u observación del administrador.                                            | -                                              |
| initialPassword | string | Sí (Solo si `status` es `approved`) | Contraseña inicial temporal que se establecerá para el usuario en Supabase Auth. | Mínimo 6 caracteres.                           |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Solicitud marcada como approved",
  "data": {
    "id": "18f9e612-4fb3-4876-b333-e99d91f21db5",
    "email": "juan.perez@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+51999999999",
    "roleRequested": "client",
    "status": "approved",
    "additionalData": {
      "referredBy": "CL-00002"
    },
    "observation": "Usuario verificado por teléfono",
    "createdAt": "2026-05-22T04:26:00.000Z",
    "updatedAt": "2026-05-22T04:28:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-22T04:28:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                                             |
| ------ | ------------------------------------------------------- |
| 200    | Solicitud procesada correctamente                       |
| 400    | Datos inválidos o la solicitud ya se encuentra aprobada |
| 401    | No autenticado                                          |
| 403    | No autorizado                                           |
| 404    | Solicitud no encontrada                                 |
| 500    | Error interno                                           |

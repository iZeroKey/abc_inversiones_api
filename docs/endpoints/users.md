# Usuarios

## Tabla de Contenidos

1. [Get Me](#get-me)
2. [Update Avatar](#update-avatar)
3. [Delete Avatar](#delete-avatar)
4. [Get All Users](#get-all-users)
5. [Get User By ID](#get-user-by-id)
6. [Update User](#update-user)
7. [Delete User](#delete-user)

---

## Get Me

Obtener el perfil del usuario actualmente autenticado.

`id` es el UUID interno. Para UI y búsquedas operativas se debe usar `publicCode` cuando exista.

Formato de códigos públicos:

| Rol           | Formato    | Ejemplo    |
| ------------- | ---------- | ---------- |
| Cliente       | `CL-00000` | `CL-00001` |
| Inversionista | `IN-00000` | `IN-00001` |
| Admin/Owner   | `AD-00000` | `AD-00001` |

### Endpoint

```
GET /api/v1/users/me
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario obtenido",
  "data": {
    "id": "uuid",
    "publicCode": "CL-00001",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+51 999 999 999",
    "avatarUrl": "https://...",
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción      |
| ------ | ---------------- |
| 200    | Usuario obtenido |
| 401    | No autenticado   |
| 500    | Error interno    |

---

## Update Avatar

Actualizar la foto de perfil.

### Endpoint

```
PATCH /api/v1/users/me/avatar
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor               | Obligatorio |
| ------------- | ------------------- | ----------- |
| Authorization | Bearer {token}      | Sí          |
| Content-Type  | multipart/form-data | Sí          |

### Cuerpo de Solicitud

| Campo  | Tipo | Descripción                       |
| ------ | ---- | --------------------------------- |
| avatar | file | Imagen (JPEG, PNG, WebP, max 5MB) |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Avatar actualizado",
  "data": {
    "avatarUrl": "https://..."
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción        |
| ------ | ------------------ |
| 200    | Avatar actualizado |
| 400    | Archivo inválido   |
| 401    | No autenticado     |
| 500    | Error interno      |

---

## Delete Avatar

Eliminar la foto de perfil del usuario actualmente autenticado. Si la foto actual fue guardada en Supabase Storage, el archivo se elimina del bucket `avatars` y el campo `avatarUrl` queda en `null`.

### Endpoint

```
DELETE /api/v1/users/me/avatar
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Foto de perfil eliminada correctamente",
  "data": {
    "id": "uuid",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+51 999 999 999",
    "avatarUrl": null,
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción      |
| ------ | ---------------- |
| 200    | Avatar eliminado |
| 401    | No autenticado   |
| 404    | Usuario no encontrado |
| 500    | Error interno    |

---

## Get All Users

Listar todos los usuarios registrados.

### Endpoint

```
GET /api/v1/users
```

### Acceso

Privado (Admin, Owner)

Los owners pueden consultar cualquier usuario. Un administrador no owner no puede gestionar a otro administrador.

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo | Tipo   | Descripción                     |
| ----- | ------ | ------------------------------- |
| page  | number | Número de página (default: 1)   |
| limit | number | Límite por página (default: 20) |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuarios obtenidos",
  "data": [
    {
      "id": "uuid",
      "publicCode": "CL-00001",
      "email": "email@example.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "role": "client",
      "active": true
    }
  ],
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción        |
| ------ | ------------------ |
| 200    | Usuarios obtenidos |
| 401    | No autorizado      |
| 500    | Error interno      |

---

## Get User By ID

Obtener información detallada de un usuario por ID.

### Endpoint

```
GET /api/v1/users/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción    |
| --------- | ---- | -------------- |
| id        | uuid | UUID interno del usuario |

### Acceso

Privado (Admin, Owner)

Los owners pueden consultar cualquier usuario. Un administrador no owner no puede gestionar a otro administrador.

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario obtenido",
  "data": {
    "id": "uuid",
    "publicCode": "CL-00001",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+51 999 999 999",
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 200    | Usuario obtenido      |
| 401    | No autorizado         |
| 404    | Usuario no encontrado |
| 500    | Error interno         |

---

## Update User

Actualizar datos de un usuario. El endpoint valida campos distintos según quien actualiza:

- El usuario autenticado solo puede actualizar sus campos de perfil: `firstName`, `lastName`, `phone`.
- Owner puede actualizar cualquier usuario, excepto contraseña y rol.
- Admin no owner puede actualizar usuarios no administradores, pero no puede gestionar a otro admin; sobre sí mismo solo actualiza campos de perfil.
- Cliente e inversionista solo pueden actualizar su propio perfil.
- El rol es inmutable: no se acepta `role` en actualizaciones.
- `isOwner` solo puede ser modificado por un owner.
- Campos sensibles como `id`, `email`, `avatarUrl`, `deletedAt`, `createdAt` y `updatedAt` no se aceptan por este endpoint.

### Endpoint

```
PATCH /api/v1/users/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción    |
| --------- | ---- | -------------- |
| id        | uuid | ID del usuario |

### Acceso

Privado

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud

Usuario actualizando su propio perfil:

```json
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string"
}
```

Admin/owner actualizando otro usuario:

```json
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "active": true,
  "isOwner": false
}
```

### Diccionario de Datos

| Campo     | Tipo    | Obligatorio | Descripción                  |
| --------- | ------- | ----------- | ---------------------------- |
| firstName | string  | No          | Nombres (min 2 caracteres)   |
| lastName  | string  | No          | Apellidos (min 2 caracteres) |
| phone     | string  | No          | Número de teléfono           |
| active    | boolean | No          | Solo admin/owner             |
| isOwner   | boolean | No          | Solo owner                   |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario actualizado",
  "data": {
    "id": "uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    ...
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 200    | Usuario actualizado   |
| 400    | Datos inválidos       |
| 401    | No autorizado         |
| 403    | Sin permiso           |
| 404    | Usuario no encontrado |
| 500    | Error interno         |

---

## Delete User

Realizar un borrado lógico (soft delete) de un usuario.

### Endpoint

```
DELETE /api/v1/users/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción    |
| --------- | ---- | -------------- |
| id        | uuid | ID del usuario |

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
  "message": "Usuario eliminado",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 200    | Usuario eliminado     |
| 401    | No autorizado         |
| 404    | Usuario no encontrado |
| 500    | Error interno         |

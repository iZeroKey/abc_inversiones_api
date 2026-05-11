# Usuarios

## Tabla de Contenidos

1. [Get Me](#get-me)
2. [Update Avatar](#update-avatar)
3. [Delete Avatar](#delete-avatar)
4. [Get All Users](#get-all-users)
5. [Create User](#create-user)
6. [Get User By ID](#get-user-by-id)
7. [Link Auth Account](#link-auth-account)
8. [Update User](#update-user)
9. [Delete User](#delete-user)

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

`email` puede ser `null` para clientes e inversionistas operativos sin cuenta Auth. Cuando el usuario tiene cuenta Auth, `authUserId` queda vinculado internamente y el login resuelve el usuario local por ese campo.

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
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
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
| search | string | Busca por código público, nombre, DNI, email, teléfono, banco o cuentas |
| q     | string | Alias de `search`               |

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
      "phone": "+51 999 999 999",
      "dni": "12345678",
      "bank": "BCP",
      "bankAccounts": ["191-1234567890"],
      "maritalStatus": "single",
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

## Create User

Crear un cliente, inversionista o administrador desde el panel administrativo. Para clientes e inversionistas se puede crear solo el registro operativo sin cuenta Auth; si se envía `createAuthAccount: true`, `email` y `password` son obligatorios y se crea/vincula la cuenta Auth.

### Endpoint

```
POST /api/v1/users
```

### Acceso

Privado (Admin, Owner)

### Cuerpo de Solicitud

```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@example.com",
  "phone": "+51 999 999 999",
  "role": "client",
  "dni": "12345678",
  "address": "Av. Principal 123",
  "bank": "BCP",
  "bankAccounts": ["191-1234567890", "002-987654321"],
  "maritalStatus": "single",
  "createAuthAccount": true,
  "password": "password123"
}
```

### Diccionario de Datos

| Campo             | Tipo      | Obligatorio | Descripción |
| ----------------- | --------- | ----------- | ----------- |
| firstName         | string    | Sí          | Nombres |
| lastName          | string    | Sí          | Apellidos |
| role              | enum      | Sí          | client, investor, admin |
| email             | string    | Solo con Auth/admin | Nullable para clientes/inversionistas sin cuenta |
| phone             | string    | No          | Teléfono |
| dni               | string    | No          | Documento |
| address           | string    | No          | Domicilio |
| bank              | string    | No          | Banco |
| bankAccounts      | string[]  | No          | Números de cuenta |
| maritalStatus     | enum      | No          | single, married, unspecified |
| createAuthAccount | boolean   | No          | Crea/vincula cuenta Auth |
| password          | string    | Solo con Auth | Contraseña temporal |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario creado",
  "data": {
    "id": "uuid",
    "publicCode": "CL-00001",
    "email": "juan@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "client",
    "bankAccounts": ["191-1234567890"]
  }
}
```

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
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
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

## Link Auth Account

Vincular una cuenta Supabase Auth a un cliente o inversionista operativo existente. El usuario debe tener o recibir un `email` válido.

### Endpoint

```
POST /api/v1/users/:id/auth-account
```

### Acceso

Privado (Admin, Owner)

### Cuerpo de Solicitud

```json
{
  "email": "cliente@example.com",
  "password": "password123"
}
```

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Cuenta Auth vinculada",
  "data": {
    "id": "uuid",
    "publicCode": "CL-00001",
    "email": "cliente@example.com",
    "role": "client"
  }
}
```

---

## Update User

Actualizar datos de un usuario. El endpoint valida campos distintos según quien actualiza:

- El usuario autenticado solo puede actualizar sus campos de perfil: `firstName`, `lastName`, `phone`, `dni`, `address`, `bank`, `bankAccounts`, `maritalStatus`.
- Owner puede actualizar cualquier usuario, excepto contraseña, rol y `authUserId`.
- Admin no owner puede actualizar usuarios no administradores, incluyendo `email` y `active`; sobre sí mismo solo actualiza campos de perfil.
- Cliente e inversionista solo pueden actualizar su propio perfil.
- El rol es inmutable: no se acepta `role` en actualizaciones.
- `isOwner` es interno y no se acepta en actualizaciones por API.
- Campos sensibles como `id`, `authUserId`, `avatarUrl`, `deletedAt`, `createdAt` y `updatedAt` no se aceptan por este endpoint.

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
  "phone": "string",
  "dni": "string",
  "address": "string",
  "bank": "string",
  "bankAccounts": ["string"],
  "maritalStatus": "single"
}
```

Admin/owner actualizando otro usuario:

```json
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "email": "string",
  "dni": "string",
  "address": "string",
  "bank": "string",
  "bankAccounts": ["string"],
  "maritalStatus": "unspecified",
  "active": true
}
```

### Diccionario de Datos

| Campo         | Tipo     | Obligatorio | Descripción                  |
| ------------- | -------- | ----------- | ---------------------------- |
| firstName     | string   | No          | Nombres (min 2 caracteres)   |
| lastName      | string   | No          | Apellidos (min 2 caracteres) |
| phone         | string   | No          | Número de teléfono           |
| email         | string   | No          | Solo admin/owner             |
| dni           | string   | No          | Documento                    |
| address       | string   | No          | Domicilio                    |
| bank          | string   | No          | Banco                        |
| bankAccounts  | string[] | No          | Números de cuenta            |
| maritalStatus | enum     | No          | single, married, unspecified |
| active        | boolean  | No          | Solo admin/owner             |

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

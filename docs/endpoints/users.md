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
  "message": "Perfil obtenido",
  "data": {
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "email@example.com",
    "phone": "+51 999 999 999",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/...",
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción     |
| ------ | --------------- |
| 200    | Perfil obtenido |
| 401    | No autenticado  |
| 500    | Error interno   |

---

## Update Avatar

Actualizar la foto de perfil del usuario actualmente autenticado. Acepta la imagen como multipart/form-data.

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
| avatar | file | Imagen (JPEG, PNG, WebP, max 2MB) |

### Respuesta Exitosa

Retorna el objeto de usuario actualizado completo con la URL firmada del avatar.

```json
{
  "success": true,
  "message": "Foto de perfil actualizada correctamente",
  "data": {
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "email@example.com",
    "phone": "+51 999 999 999",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/...",
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                              |
| ------ | ---------------------------------------- |
| 200    | Foto de perfil actualizada correctamente |
| 400    | Datos/archivo inválidos                  |
| 401    | No autenticado                           |
| 500    | Error interno                            |

---

## Delete Avatar

Eliminar la foto de perfil del usuario actualmente autenticado. Borra el objeto en Supabase Storage y establece `avatarUrl` en `null`.

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

Retorna el objeto de usuario actualizado completo.

```json
{
  "success": true,
  "message": "Foto de perfil eliminada correctamente",
  "data": {
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "email@example.com",
    "phone": "+51 999 999 999",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": null,
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                            |
| ------ | -------------------------------------- |
| 200    | Foto de perfil eliminada correctamente |
| 401    | No autenticado                         |
| 404    | Usuario no encontrado                  |
| 500    | Error interno                          |

---

## Get All Users

Listar todos los usuarios registrados con paginación y filtros.

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

| Campo  | Tipo    | Obligatorio | Descripción                                                                                 |
| ------ | ------- | ----------- | ------------------------------------------------------------------------------------------- |
| page   | number  | No          | Número de página (default: `1`).                                                            |
| limit  | number  | No          | Límite por página (default: `20`, máximo: `100`).                                           |
| role   | string  | No          | Filtrar por rol (`"client"`, `"investor"`, `"admin"`).                                      |
| active | boolean | No          | Filtrar por estado activo/inactivo.                                                         |
| search | string  | No          | Busca por coincidencia parcial en publicCode, firstName, lastName, email, phone, dni o bank |
| q      | string  | No          | Alias para `search`                                                                         |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuarios obtenidos",
  "data": [
    {
      "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
      "authUserId": "supabase-auth-uuid",
      "publicCode": "CL-00001",
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "email@example.com",
      "phone": "+51 999 999 999",
      "dni": "12345678",
      "address": "Av. Principal 123",
      "bank": "BCP",
      "bankAccounts": ["191-1234567890"],
      "maritalStatus": "single",
      "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/...",
      "role": "client",
      "isOwner": false,
      "active": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    },
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción        |
| ------ | ------------------ |
| 200    | Usuarios obtenidos |
| 401    | No autenticado     |
| 403    | No autorizado      |
| 500    | Error interno      |

---

## Create User

Crear un nuevo usuario (cliente, inversionista o administrador) desde el panel administrativo.

Si `createAuthAccount` es `true`, es mandatorio enviar un `email` válido y un `password` (mínimo 6 caracteres). Si `createAuthAccount` es `false`, se crea el usuario con perfil únicamente operativo sin cuenta Auth.

### Endpoint

```
POST /api/v1/users
```

### Acceso

Privado (Admin, Owner)

Los owners pueden crear cualquier usuario. Un administrador no owner no puede crear usuarios con el rol `admin`.

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Content-Type  | application/json | Sí          |
| Authorization | Bearer {token}   | Sí          |

### Cuerpo de Solicitud

```json
{
  "publicCode": "CL-00001",
  "email": "juan@example.com",
  "password": "password123",
  "createAuthAccount": true,
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+51 999 999 999",
  "role": "client",
  "dni": "12345678",
  "address": "Av. Principal 123",
  "bank": "BCP",
  "bankAccounts": ["191-1234567890"],
  "maritalStatus": "single",
  "active": true
}
```

### Diccionario de Datos

| Campo             | Tipo     | Obligatorio                      | Descripción                                                          |
| ----------------- | -------- | -------------------------------- | -------------------------------------------------------------------- |
| publicCode        | string   | No                               | Código público. Si no se envía, se autogenera según el rol asignado. |
| email             | string   | Si `createAuthAccount` es `true` | Dirección de correo única.                                           |
| password          | string   | Si `createAuthAccount` es `true` | Contraseña temporal para la cuenta de acceso (mínimo 6 caracteres).  |
| createAuthAccount | boolean  | No (default: `false`)            | Indica si se debe crear y vincular una cuenta en Supabase Auth.      |
| firstName         | string   | Sí                               | Nombres (mínimo 2 caracteres).                                       |
| lastName          | string   | Sí                               | Apellidos (mínimo 2 caracteres).                                     |
| phone             | string   | No                               | Número de teléfono.                                                  |
| role              | enum     | No (default: `client`)           | Permite `"client"`, `"investor"`, `"admin"`.                         |
| dni               | string   | No                               | Documento nacional de identidad.                                     |
| address           | string   | No                               | Domicilio o dirección.                                               |
| bank              | string   | No                               | Banco para depósitos/transferencias.                                 |
| bankAccounts      | string[] | No (default: `[]`)               | Lista de números de cuentas bancarias.                               |
| maritalStatus     | enum     | No                               | Estado civil. Permite `"single"`, `"married"`, `"unspecified"`.      |
| active            | boolean  | No (default: `true`)             | Estado activo/inactivo del usuario.                                  |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario creado correctamente",
  "data": {
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com",
    "phone": "+51 999 999 999",
    "role": "client",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": null,
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                  |
| ------ | ---------------------------- |
| 201    | Usuario creado correctamente |
| 400    | Datos inválidos              |
| 401    | No autenticado               |
| 403    | No autorizado / Sin permiso  |
| 500    | Error interno                |

---

## Get User By ID

Obtener información detallada de un usuario por su ID (UUID).

### Endpoint

```
GET /api/v1/users/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción              |
| --------- | ---- | ----------- | ------------------------ |
| id        | uuid | Sí          | UUID interno del usuario |

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
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "email@example.com",
    "phone": "+51 999 999 999",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/...",
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": null
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
| 401    | No autenticado        |
| 403    | Sin permiso           |
| 404    | Usuario no encontrado |
| 500    | Error interno         |

---

## Link Auth Account

Vincular una cuenta Supabase Auth a un cliente o inversionista operativo existente. Crea una credencial de acceso en Supabase Auth y vincula el `authUserId` y `email` en la base de datos local.

### Endpoint

```
POST /api/v1/users/:id/auth-account
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                       |
| --------- | ---- | ----------- | --------------------------------- |
| id        | uuid | Sí          | UUID del usuario local a vincular |

### Acceso

Privado (Admin, Owner)

Un administrador no owner no puede realizar esta vinculación sobre un usuario administrador.

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Content-Type  | application/json | Sí          |
| Authorization | Bearer {token}   | Sí          |

### Cuerpo de Solicitud

```json
{
  "email": "cliente@example.com",
  "password": "password123"
}
```

### Respuesta Exitosa

Retorna el objeto de usuario actualizado.

```json
{
  "success": true,
  "message": "Cuenta de acceso vinculada correctamente",
  "data": {
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "cliente@example.com",
    "phone": "+51 999 999 999",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": null,
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                               |
| ------ | ----------------------------------------- |
| 200    | Cuenta de acceso vinculada correctamente  |
| 400    | Datos inválidos o usuario ya tiene cuenta |
| 401    | No autenticado                            |
| 403    | Sin permiso                               |
| 404    | Usuario no encontrado                     |
| 500    | Error interno                             |

---

## Update User

Actualizar datos de un usuario por su ID. La validación varía según quién realiza la llamada:

- **Autogestión (Perfil propio):** El usuario solo puede actualizar `firstName`, `lastName`, `phone`, `dni`, `address`, `bank`, `bankAccounts`, `maritalStatus`. No puede modificar campos administrativos (`id`, `authUserId`, `publicCode`, `email`, `avatarUrl`, `role`, `active`, `isOwner`, `createdAt`, `updatedAt`, `deletedAt`).
- **Administrativo (Admin, Owner):** Pueden actualizar además `email` y `active` para otros usuarios. Los administradores no pueden actualizar a otros administradores.
- **Inmutabilidad:** El rol (`role`) e `isOwner` son completamente inmutables a través de este endpoint.

### Endpoint

```
PATCH /api/v1/users/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción               |
| --------- | ---- | ----------- | ------------------------- |
| id        | uuid | Sí          | UUID del usuario a editar |

### Acceso

Privado (Cualquier usuario autenticado para su propio perfil; Admin y Owner para otros usuarios autorizados).

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Content-Type  | application/json | Sí          |
| Authorization | Bearer {token}   | Sí          |

### Cuerpo de Solicitud

```json
{
  "firstName": "Juan Carlos",
  "lastName": "Pérez Prado",
  "phone": "+51 987 654 321",
  "email": "newemail@example.com",
  "active": true
}
```

### Respuesta Exitosa

Retorna el objeto de usuario actualizado con la URL firmada del avatar.

```json
{
  "success": true,
  "message": "Usuario actualizado correctamente",
  "data": {
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan Carlos",
    "lastName": "Pérez Prado",
    "email": "newemail@example.com",
    "phone": "+51 987 654 321",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/...",
    "role": "client",
    "isOwner": false,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                       |
| ------ | --------------------------------- |
| 200    | Usuario actualizado correctamente |
| 400    | Datos o campos no permitidos      |
| 401    | No autenticado                    |
| 403    | Sin permiso                       |
| 404    | Usuario no encontrado             |
| 500    | Error interno                     |

---

## Delete User

Realizar la desactivación de un usuario mediante borrado lógico (soft delete). Se establece `active` en `false` y `deletedAt` en la fecha actual.

### Endpoint

```
DELETE /api/v1/users/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción               |
| --------- | ---- | ----------- | ------------------------- |
| id        | uuid | Sí          | UUID del usuario a borrar |

### Acceso

Privado (Admin, Owner)

Los owners pueden desactivar cualquier usuario. Un administrador no owner no puede desactivar a otro administrador.

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

Retorna el objeto del usuario desactivado.

```json
{
  "success": true,
  "message": "Usuario desactivado correctamente",
  "data": {
    "id": "8939c0f9-22a0-4ff5-b98a-5439c28ea56f",
    "authUserId": "supabase-auth-uuid",
    "publicCode": "CL-00001",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "email@example.com",
    "phone": "+51 999 999 999",
    "dni": "12345678",
    "address": "Av. Principal 123",
    "bank": "BCP",
    "bankAccounts": ["191-1234567890"],
    "maritalStatus": "single",
    "avatarUrl": null,
    "role": "client",
    "isOwner": false,
    "active": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "deletedAt": "2026-05-22T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                       |
| ------ | --------------------------------- |
| 200    | Usuario desactivado correctamente |
| 401    | No autenticado                    |
| 403    | Sin permiso                       |
| 404    | Usuario no encontrado             |
| 500    | Error interno                     |

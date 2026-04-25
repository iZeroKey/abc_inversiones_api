# Usuarios

## Tabla de Contenidos

1. [Get Me](#get-me)
2. [Update Avatar](#update-avatar)
3. [Get All Users](#get-all-users)
4. [Get User By ID](#get-user-by-id)
5. [Update User](#update-user)
6. [Delete User](#delete-user)

---

## Get Me

Obtener el perfil del usuario actualmente autenticado.

### Endpoint

```
GET /api/v1/users/me
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario obtenido",
  "data": {
    "id": "uuid",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
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

| Codigo | Descripcion      |
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
| Authorization | Bearer {token}      | Si          |
| Content-Type  | multipart/form-data | Si          |

### Cuerpo de Solicitud

| Campo  | Tipo | Descripcion                       |
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

| Codigo | Descripcion        |
| ------ | ------------------ |
| 200    | Avatar actualizado |
| 400    | Archivo invalido   |
| 401    | No autenticado     |
| 500    | Error interno      |

---

## Get All Users

Listar todos los usuarios registrados.

### Endpoint

```
GET /api/v1/users
```

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Parametros de Consulta

| Campo | Tipo   | Descripcion                     |
| ----- | ------ | ------------------------------- |
| page  | number | Numero de pagina (default: 1)   |
| limit | number | Limite por pagina (default: 20) |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuarios obtenidos",
  "data": [
    {
      "id": "uuid",
      "email": "email@example.com",
      "firstName": "Juan",
      "lastName": "Perez",
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

| Codigo | Descripcion        |
| ------ | ------------------ |
| 200    | Usuarios obtenidos |
| 401    | No autorizado      |
| 500    | Error interno      |

---

## Get User By ID

Obtener informacion detallada de un usuario por ID.

### Endpoint

```
GET /api/v1/users/:id
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion    |
| --------- | ---- | -------------- |
| id        | uuid | ID del usuario |

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
  "message": "Usuario obtido",
  "data": {
    "id": "uuid",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
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

| Codigo | Descripcion           |
| ------ | --------------------- |
| 200    | Usuario obtenido      |
| 401    | No autorizado         |
| 404    | Usuario no encontrado |
| 500    | Error interno         |

---

## Update User

Actualizar datos de un usuario.

### Endpoint

```
PATCH /api/v1/users/:id
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion    |
| --------- | ---- | -------------- |
| id        | uuid | ID del usuario |

### Acceso

Privado

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Si          |
| Content-Type  | application/json | Si          |

### Cuerpo de Solicitud

```json
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "role": "client | investor | admin",
  "active": true
}
```

### Diccionario de Datos

| Campo     | Tipo    | Obligatorio | Descripcion                  |
| --------- | ------- | ----------- | ---------------------------- |
| firstName | string  | No          | Nombres (min 2 caracteres)   |
| lastName  | string  | No          | Apellidos (min 2 caracteres) |
| phone     | string  | No          | Numero de telefono           |
| role      | enum    | No          | Rol del usuario              |
| active    | boolean | No          | Estado activo                |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario actualizado",
  "data": {
    "id": "uuid",
    "firstName": "Juan",
    "lastName": "Perez",
    ...
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion           |
| ------ | --------------------- |
| 200    | Usuario actualizado   |
| 400    | Datos invalidos       |
| 401    | No autorizado         |
| 404    | Usuario no encontrado |
| 500    | Error interno         |

---

## Delete User

Realizar un borrado lógico (soft delete) de un usuario.

### Endpoint

```
DELETE /api/v1/users/:id
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion    |
| --------- | ---- | -------------- |
| id        | uuid | ID del usuario |

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
  "message": "Usuario eliminado",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion           |
| ------ | --------------------- |
| 200    | Usuario eliminado     |
| 401    | No autorizado         |
| 404    | Usuario no encontrado |
| 500    | Error interno         |

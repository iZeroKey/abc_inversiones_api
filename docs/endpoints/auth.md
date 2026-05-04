# Autenticacion

## Tabla de Contenidos

1. [Login](#login)
2. [Refresh](#refresh)
3. [Logout](#logout)
4. [Register](#register)
5. [Change Password](#change-password)

---

## Login

Iniciar sesion en la plataforma y obtener token de sesion.

### Endpoint

```
POST /api/v1/auth/login
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
  "password": "string"
}
```

### Diccionario de Datos

| Campo    | Tipo   | Obligatorio | Descripcion        | Restricciones            |
| -------- | ------ | ----------- | ------------------ | ------------------------ |
| email    | string | Si          | Correo electronico | Debe ser un email valido |
| password | string | Si          | Contrasena         | Minimo 6 caracteres      |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": "uuid",
      "email": "email@example.com",
      "firstName": "Juan",
      "lastName": "Perez",
      "role": "client",
      "isOwner": false,
      "active": true
    },
    "session": {
      "access_token": "xxxx...",
      "refresh_token": "xxxx...",
      "expires_in": 3600
    }
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "Credenciales invalidas",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion            |
| ------ | ---------------------- |
| 200    | Login exitoso          |
| 400    | Datos invalidos        |
| 401    | Credenciales invalidas |
| 500    | Error interno          |

---

## Refresh

Refrescar la sesion usando el `refresh_token` devuelto por login. Supabase rota el `refresh_token`, por lo que el cliente debe guardar el nuevo valor retornado.

### Endpoint

```
POST /api/v1/auth/refresh
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
  "refresh_token": "string"
}
```

### Diccionario de Datos

| Campo         | Tipo   | Obligatorio | Descripcion                    | Restricciones        |
| ------------- | ------ | ----------- | ------------------------------ | -------------------- |
| refresh_token | string | Si          | Token de refresco de la sesion | No puede estar vacio |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Sesion refrescada correctamente",
  "data": {
    "session": {
      "access_token": "xxxx...",
      "refresh_token": "xxxx...",
      "expires_in": 3600
    }
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "Refresh token invalido o expirado",
  "data": "Invalid Refresh Token: Refresh Token Not Found",
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion                       |
| ------ | --------------------------------- |
| 200    | Sesion refrescada correctamente   |
| 400    | Datos invalidos                   |
| 401    | Refresh token invalido o expirado |
| 500    | Error interno                     |

---

## Logout

Cerrar la sesion activa del usuario.

### Endpoint

```
POST /api/v1/auth/logout
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Cuerpo de Solicitud

Sin cuerpo

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Logout exitoso",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion    |
| ------ | -------------- |
| 200    | Logout exitoso |
| 401    | No autenticado |
| 500    | Error interno  |

---

## Register

Registrar manualmente un nuevo usuario. Solo accesible por administradores.

### Endpoint

```
POST /api/v1/auth/register
```

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
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "role": "client | investor | admin",
  "isOwner": false
}
```

### Diccionario de Datos

| Campo     | Tipo    | Obligatorio | Descripcion        | Restricciones                             |
| --------- | ------- | ----------- | ------------------ | ----------------------------------------- |
| email     | string  | Si          | Correo electronico | Debe ser un email valido y unico          |
| password  | string  | Si          | Contrasena         | Minimo 6 caracteres                       |
| firstName | string  | Si          | Nombres            | Minimo 2 caracteres                       |
| lastName  | string  | Si          | Apellidos          | Minimo 2 caracteres                       |
| phone     | string  | No          | Telefono           | -                                         |
| role      | enum    | No          | Rol del usuario    | client, investor, admin (default: client) |
| isOwner   | boolean | No          | Es propietario     | (default: false)                          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "id": "uuid",
    "email": "email@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
    "role": "client"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion     |
| ------ | --------------- |
| 201    | Usuario creado  |
| 400    | Datos invalidos |
| 401    | No autorizado   |
| 409    | Email ya existe |
| 500    | Error interno   |

---

## Change Password

Cambiar la contrasena del usuario autenticado tras verificar la actual.

### Endpoint

```
POST /api/v1/auth/change-password
```

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
  "currentPassword": "string",
  "newPassword": "string"
}
```

### Diccionario de Datos

| Campo           | Tipo   | Obligatorio | Descripcion       | Restricciones       |
| --------------- | ------ | ----------- | ----------------- | ------------------- |
| currentPassword | string | Si          | Contrasena actual | Minimo 1 caracter   |
| newPassword     | string | Si          | Nueva contrasena  | Minimo 6 caracteres |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Contrasena cambiada exitosamente",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "La contrasena actual es incorrecta",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion                           |
| ------ | ------------------------------------- |
| 200    | Contrasena cambiada                   |
| 400    | Datos invalidos                       |
| 401    | No autorizado o contrasena incorrecta |
| 500    | Error interno                         |

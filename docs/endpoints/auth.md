# Autenticación

## Tabla de Contenidos

1. [Login](#login)
2. [Refresh](#refresh)
3. [Logout](#logout)
4. [Register](#register)
5. [Change Password](#change-password)

---

## Login

Iniciar sesión en la plataforma y obtener token de sesión.

### Endpoint

```
POST /api/v1/auth/login
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
  "password": "string"
}
```

### Diccionario de Datos

| Campo    | Tipo   | Obligatorio | Descripción        | Restricciones            |
| -------- | ------ | ----------- | ------------------ | ------------------------ |
| email    | string | Sí          | Correo electrónico | Debe ser un email válido |
| password | string | Sí          | Contraseña         | Mínimo 6 caracteres      |

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
      "lastName": "Pérez",
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
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "Credenciales incorrectas",
  "data": null,
  "meta": {
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción              |
| ------ | ------------------------ |
| 200    | Login exitoso            |
| 400    | Datos inválidos          |
| 401    | Credenciales incorrectas |
| 500    | Error interno            |

---

## Refresh

Refrescar la sesión usando el `refresh_token` devuelto por login. Supabase rota el `refresh_token`, por lo que el cliente debe guardar el nuevo valor retornado.

### Endpoint

```
POST /api/v1/auth/refresh
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
  "refresh_token": "string"
}
```

### Diccionario de Datos

| Campo         | Tipo   | Obligatorio | Descripción                    | Restricciones        |
| ------------- | ------ | ----------- | ------------------------------ | -------------------- |
| refresh_token | string | Sí          | Token de refresco de la sesión | No puede estar vacío |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Sesión refrescada correctamente",
  "data": {
    "session": {
      "access_token": "xxxx...",
      "refresh_token": "xxxx...",
      "expires_in": 3600
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "Refresh token inválido o expirado",
  "data": "Invalid Refresh Token: Refresh Token Not Found",
  "meta": {
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                       |
| ------ | --------------------------------- |
| 200    | Sesión refrescada correctamente   |
| 400    | Datos inválidos                   |
| 401    | Refresh token inválido o expirado |
| 500    | Error interno                     |

---

## Logout

Cerrar la sesión del usuario autenticado. El backend llama a Supabase Admin con el JWT recibido y scope `global`, por lo que revoca refresh tokens/sesiones asociadas. Los access tokens ya emitidos pueden seguir siendo válidos hasta su expiración; el cliente debe borrar su sesión local al recibir 200.

### Endpoint

```
POST /api/v1/auth/logout
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Cuerpo de Solicitud

Sin cuerpo

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Sesión cerrada correctamente",
  "meta": {
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                  |
| ------ | ---------------------------- |
| 200    | Sesión cerrada correctamente |
| 401    | No autenticado               |
| 500    | Error interno                |

---

## Register

Registrar manualmente un nuevo usuario. El owner puede crear cualquier rol. Un administrador no owner puede crear clientes e inversionistas, pero no administradores. El flag `isOwner` es interno y no puede asignarse por API.

### Endpoint

```
POST /api/v1/auth/register
```

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
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+51999999999",
  "role": "client",
  "dni": "12345678",
  "address": "Calle Falsa 123",
  "bank": "Banco Central",
  "bankAccounts": ["123-456789-0-99"],
  "maritalStatus": "single"
}
```

### Diccionario de Datos

| Campo         | Tipo             | Obligatorio | Descripción                     | Restricciones                                          |
| ------------- | ---------------- | ----------- | ------------------------------- | ------------------------------------------------------ |
| email         | string           | Sí          | Correo electrónico              | Debe ser un email válido y único                       |
| password      | string           | Sí          | Contraseña                      | Mínimo 6 caracteres                                    |
| firstName     | string           | Sí          | Nombres                         | Mínimo 2 caracteres                                    |
| lastName      | string           | Sí          | Apellidos                       | Mínimo 2 caracteres                                    |
| phone         | string           | No          | Teléfono                        | Opcional                                               |
| role          | enum             | No          | Rol del usuario                 | client, investor, admin (default: client)              |
| dni           | string           | No          | Documento Nacional de Identidad | Opcional, puede ser null                               |
| address       | string           | No          | Dirección de domicilio          | Opcional, puede ser null                               |
| bank          | string           | No          | Banco del usuario               | Opcional, puede ser null                               |
| bankAccounts  | array of strings | No          | Lista de cuentas bancarias      | Opcional, default: `[]`                                |
| maritalStatus | enum             | No          | Estado civil                    | single, married, unspecified. Opcional, puede ser null |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "id": "uuid",
      "authUserId": "uuid",
      "publicCode": "CL-00001",
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "user@example.com",
      "phone": "+51999999999",
      "dni": "12345678",
      "address": "Calle Falsa 123",
      "bank": "Banco Central",
      "bankAccounts": ["123-456789-0-99"],
      "maritalStatus": "single",
      "role": "client",
      "isOwner": false,
      "active": true,
      "avatarUrl": null,
      "createdAt": "2026-05-22T04:00:00.000Z",
      "updatedAt": "2026-05-22T04:00:00.000Z",
      "deletedAt": null
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción     |
| ------ | --------------- |
| 201    | Usuario creado  |
| 400    | Datos inválidos |
| 401    | No autorizado   |
| 409    | Email ya existe |
| 500    | Error interno   |

---

## Change Password

Cambiar la contraseña del usuario autenticado tras verificar la actual.
La contraseña actual se verifica con Supabase Auth y el cambio se aplica en backend con Supabase Admin sobre el ID del usuario autenticado.

### Endpoint

```
POST /api/v1/auth/change-password
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### Diccionario de Datos

| Campo           | Tipo   | Obligatorio | Descripción       | Restricciones       |
| --------------- | ------ | ----------- | ----------------- | ------------------- |
| currentPassword | string | Sí          | Contraseña actual | Mínimo 1 carácter   |
| newPassword     | string | Sí          | Nueva contraseña  | Mínimo 6 caracteres |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Contraseña actualizada correctamente",
  "meta": {
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "La contraseña actual es incorrecta",
  "data": null,
  "meta": {
    "timestamp": "2026-05-22T04:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                           |
| ------ | ------------------------------------- |
| 200    | Contraseña actualizada correctamente  |
| 400    | Datos inválidos                       |
| 401    | No autorizado o contraseña incorrecta |
| 500    | Error interno                         |

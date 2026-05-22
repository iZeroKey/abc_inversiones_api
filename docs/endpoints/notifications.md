# Notificaciones

## Tabla de Contenidos

1. [Get My Notifications](#get-my-notifications)
2. [Mark All As Read](#mark-all-as-read)
3. [Mark As Read](#mark-as-read)

---

## Get My Notifications

Obtener notificaciones del usuario actual. Sin parámetros mantiene compatibilidad y devuelve la primera página con `limit=20`.

### Endpoint

```
GET /api/v1/notifications
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo  | Tipo    | Descripción                                          |
| ------ | ------- | ---------------------------------------------------- |
| isRead | boolean | Opcional. `true` para leídas, `false` para no leídas |
| page   | number  | Opcional. Número de página, default 1                |
| limit  | number  | Opcional. Límite por página, default 20, max 50      |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Notificaciones obtenidas",
  "data": [
    {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "userId": "uuid-user-id",
      "title": "Préstamo aprobado",
      "body": "Tu préstamo ha sido aprobado",
      "type": "LOAN_APPROVED",
      "isRead": false,
      "data": "{\"loanId\":\"2bb837fa-f182-4aa8-9283-718293bc9281\"}",
      "createdAt": "2026-05-22T04:30:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z",
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "unreadCount": 1
  }
}
```

`total` respeta el filtro `isRead`. `unreadCount` siempre representa todas las notificaciones no leídas del usuario, independientemente del filtro. `totalPages` usa mínimo 1, incluso cuando `total` es 0.

### Códigos de Estado HTTP

| Código | Descripción              |
| ------ | ------------------------ |
| 200    | Notificaciones obtenidas |
| 401    | No autorizado            |
| 500    | Error interno            |

---

## Mark All As Read

Marcar todas las notificaciones como leídas.

### Endpoint

```
PATCH /api/v1/notifications/read-all
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
  "message": "Todas las notificaciones marcadas como leídas",
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

> [!NOTE]
> La llave `data` se omite de la respuesta (es `undefined` en lugar de `null`).

### Códigos de Estado HTTP

| Código | Descripción                                   |
| ------ | --------------------------------------------- |
| 200    | Todas las notificaciones marcadas como leídas |
| 401    | No autorizado                                 |
| 500    | Error interno                                 |

---

## Mark As Read

Marcar una notificación específica como leída.

### Endpoint

```
PATCH /api/v1/notifications/:id/read
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción           |
| --------- | ---- | --------------------- |
| id        | uuid | ID de la notificación |

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
  "message": "Notificación marcada como leída",
  "data": {
    "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
    "userId": "uuid-user-id",
    "title": "Préstamo aprobado",
    "body": "Tu préstamo ha sido aprobado",
    "type": "LOAN_APPROVED",
    "isRead": true,
    "data": "{\"loanId\":\"2bb837fa-f182-4aa8-9283-718293bc9281\"}",
    "createdAt": "2026-05-22T04:30:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                |
| ------ | -------------------------- |
| 200    | Notificación actualizada   |
| 401    | No autorizado              |
| 404    | Notificación no encontrada |
| 500    | Error interno              |

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
      "id": "uuid",
      "title": "Préstamo aprobado",
      "body": "Tu préstamo ha sido aprobado",
      "type": "LOAN_APPROVED",
      "isRead": false,
      "data": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z",
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
  "message": "Notificaciones marcadas como leídas",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                 |
| ------ | --------------------------- |
| 200    | Notificaciones actualizadas |
| 401    | No autorizado               |
| 500    | Error interno               |

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
    "id": "uuid",
    "isRead": true
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
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

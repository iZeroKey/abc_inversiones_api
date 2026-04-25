# Notificaciones

## Tabla de Contenidos

1. [Get My Notifications](#get-my-notifications)
2. [Mark All As Read](#mark-all-as-read)
3. [Mark As Read](#mark-as-read)

---

## Get My Notifications

Obtener notificaciones del usuario actual.

### Endpoint

```
GET /api/v1/notifications
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Parametros de Consulta

| Campo  | Tipo    | Descripcion                   |
| ------ | ------- | ----------------------------- |
| isRead | boolean | Filtrar por estado de lectura |
| page   | number  | Numero de pagina              |
| limit  | number  | Limite por pagina             |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Notificaciones obtenidas",
  "data": [
    {
      "id": "uuid",
      "title": "Prestamo aprobado",
      "body": "Tu prestamo ha sido aprobado",
      "type": "LOAN_APPROVED",
      "isRead": false,
      "data": null,
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

| Codigo | Descripcion              |
| ------ | ------------------------ |
| 200    | Notificaciones obtenidas |
| 401    | No autorizado            |
| 500    | Error interno            |

---

## Mark All As Read

Marcar todas las notificaciones como leidas.

### Endpoint

```
PATCH /api/v1/notifications/read-all
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
  "message": "Notificaciones marcadas como leidas",
  "data": null,
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion                 |
| ------ | --------------------------- |
| 200    | Notificaciones actualizadas |
| 401    | No autorizado               |
| 500    | Error interno               |

---

## Mark As Read

Marcar una notificación específica como leida.

### Endpoint

```
PATCH /api/v1/notifications/:id/read
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion           |
| --------- | ---- | --------------------- |
| id        | uuid | ID de la notificacion |

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
  "message": "Notificacion marcada como leida",
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

| Codigo | Descripcion                |
| ------ | -------------------------- |
| 200    | Notificacion actualizada   |
| 401    | No autorizado              |
| 404    | Notificacion no encontrada |
| 500    | Error interno              |

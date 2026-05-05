# Auditoría

## Tabla de Contenidos

1. [Get Audit Logs](#get-audit-logs)

---

## Get Audit Logs

Listar logs de auditoría.

### Endpoint

```
GET /api/v1/audit-logs
```

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo    | Tipo   | Descripción         |
| -------- | ------ | ------------------- |
| userId   | uuid   | Filtrar por usuario |
| action   | string | Filtrar por acción  |
| module   | string | Filtrar por módulo  |
| entityId | uuid   | Filtrar por entidad |
| page     | number | Número de página    |
| limit    | number | Límite por página   |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Logs obtenidos",
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "action": "CREATE_LOAN",
      "module": "LOANS",
      "entityId": "uuid",
      "oldData": null,
      "newData": {...},
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
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

| Código | Descripción    |
| ------ | -------------- |
| 200    | Logs obtenidos |
| 401    | No autorizado  |
| 500    | Error interno  |

### Acciones Comunes

| Acción          | Descripción         |
| --------------- | ------------------- |
| CREATE_LOAN     | Crear préstamo      |
| UPDATE_LOAN     | Actualizar préstamo |
| APPROVE_LOAN    | Aprobar préstamo    |
| REJECT_LOAN     | Rechazar préstamo   |
| CREATE_PAYMENT  | Registrar pago      |
| SUBMIT_VOUCHER  | Subir voucher       |
| PROCESS_VOUCHER | Procesar voucher    |
| CREATE_USER     | Crear usuario       |
| UPDATE_USER     | Actualizar usuario  |
| DELETE_USER     | Eliminar usuario    |
| CHANGE_PASSWORD | Cambiar contraseña  |

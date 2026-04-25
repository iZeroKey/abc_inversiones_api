# Auditoria

## Tabla de Contenidos

1. [Get Audit Logs](#get-audit-logs)

---

## Get Audit Logs

Listar logs de auditoria.

### Endpoint

```
GET /api/v1/audit-logs
```

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Parametros de Consulta

| Campo    | Tipo   | Descripcion         |
| -------- | ------ | ------------------- |
| userId   | uuid   | Filtrar por usuario |
| action   | string | Filtrar por accion  |
| module   | string | Filtrar por modulo  |
| entityId | uuid   | Filtrar por entidad |
| page     | number | Numero de pagina    |
| limit    | number | Limite por pagina   |

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

| Codigo | Descripcion    |
| ------ | -------------- |
| 200    | Logs obtenidos |
| 401    | No autorizado  |
| 500    | Error interno  |

### Acciones Comunes

| Accion          | Descripcion         |
| --------------- | ------------------- |
| CREATE_LOAN     | Crear prestamo      |
| UPDATE_LOAN     | Actualizar prestamo |
| APPROVE_LOAN    | Aprobar prestamo    |
| REJECT_LOAN     | Rechazar prestamo   |
| CREATE_PAYMENT  | Registrar pago      |
| SUBMIT_VOUCHER  | Subir voucher       |
| PROCESS_VOUCHER | Procesar voucher    |
| CREATE_USER     | Crear usuario       |
| UPDATE_USER     | Actualizar usuario  |
| DELETE_USER     | Eliminar usuario    |
| CHANGE_PASSWORD | Cambiar contrasena  |

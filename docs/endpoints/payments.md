# Pagos

## Tabla de Contenidos

1. [Register Payment](#register-payment)
2. [Get Payments By Loan](#get-payments-by-loan)

---

## Register Payment

Registrar un nuevo pago de un cliente. El pago se aplica dentro de una transacción a cuotas `pending` y `overdue`, ordenadas por `dueDate`.

Reglas de aplicación:

- El préstamo debe existir y estar `active`.
- La deuda pendiente real se calcula como suma de `amount - paidAmount` de cuotas `pending` y `overdue`.
- Los pagos excedentes se rechazan con 400; no se registra monto excedente ni saldo a favor.
- Una cuota `overdue` completada pasa a `paid`.
- Una cuota pagada parcialmente queda `overdue` si su vencimiento ya paso respecto a `paymentDate`; si no, queda `pending`.
- Cuando todas las cuotas quedan `paid`, el préstamo pasa a `paid`.

### Endpoint

```
POST /api/v1/payments
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
  "loanId": "uuid",
  "installmentId": "uuid",
  "amount": "string",
  "paymentDate": "ISO8601 date",
  "method": "cash | transfer | deposit | other",
  "reference": "string",
  "observation": "string"
}
```

### Diccionario de Datos

| Campo         | Tipo   | Obligatorio | Descripción     | Restricciones                                  |
| ------------- | ------ | ----------- | --------------- | ---------------------------------------------- |
| loanId        | uuid   | Sí          | ID del préstamo | UUID válido                                    |
| installmentId | uuid   | No          | ID de la cuota  | UUID válido                                    |
| amount        | string | Sí          | Monto del pago  | Número positivo                                |
| paymentDate   | string | No          | Fecha del pago  | ISO8601                                        |
| method        | enum   | No          | Método de pago  | cash, transfer, deposit, other (default: cash) |
| reference     | string | No          | Referencia      | -                                              |
| observation   | string | No          | Observación     | -                                              |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Pago registrado",
  "data": {
    "id": "uuid",
    "loanId": "uuid",
    "amount": "5000.00",
    "paymentDate": "2026-01-01T00:00:00.000Z",
    "method": "transfer",
    "status": "confirmed"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 201    | Pago registrado        |
| 400    | Datos inválidos, préstamo no activo o pago excedente |
| 401    | No autorizado          |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Get Payments By Loan

Obtener el historial de pagos registrados para un préstamo específico.

### Endpoint

```
GET /api/v1/payments/loan/:loanId
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción     |
| --------- | ---- | --------------- |
| loanId    | uuid | ID del préstamo |

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
  "message": "Pagos obtenidos",
  "data": [
    {
      "id": "uuid",
      "amount": "5000.00",
      "paymentDate": "2026-01-01T00:00:00.000Z",
      "method": "transfer",
      "reference": "OP123456",
      "status": "confirmed",
      "registeredById": "uuid",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Pagos obtenidos        |
| 401    | No autorizado          |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

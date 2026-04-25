# Pagos

## Tabla de Contenidos

1. [Register Payment](#register-payment)
2. [Get Payments By Loan](#get-payments-by-loan)

---

## Register Payment

Registrar un nuevo pago de un cliente.

### Endpoint

```
POST /api/v1/payments
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

| Campo         | Tipo   | Obligatorio | Descripcion     | Restricciones                                  |
| ------------- | ------ | ----------- | --------------- | ---------------------------------------------- |
| loanId        | uuid   | Si          | ID del prestamo | UUID valido                                    |
| installmentId | uuid   | No          | ID de la cuota  | UUID valido                                    |
| amount        | string | Si          | Monto del pago  | Numero positivo                                |
| paymentDate   | string | No          | Fecha del pago  | ISO8601                                        |
| method        | enum   | No          | Metodo de pago  | cash, transfer, deposit, other (default: cash) |
| reference     | string | No          | Referencia      | -                                              |
| observation   | string | No          | Observacion     | -                                              |

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

| Codigo | Descripcion            |
| ------ | ---------------------- |
| 201    | Pago registrado        |
| 400    | Datos invalidos        |
| 401    | No autorizado          |
| 404    | Prestamo no encontrado |
| 500    | Error interno          |

---

## Get Payments By Loan

Obtener el historial de pagos registrados para un prestamo especifico.

### Endpoint

```
GET /api/v1/payments/loan/:loanId
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion     |
| --------- | ---- | --------------- |
| loanId    | uuid | ID del prestamo |

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

| Codigo | Descripcion            |
| ------ | ---------------------- |
| 200    | Pagos obtenidos        |
| 401    | No autorizado          |
| 404    | Prestamo no encontrado |
| 500    | Error interno          |

# Préstamos

## Tabla de Contenidos

1. [Create Loan](#create-loan)
2. [Get All Loans](#get-all-loans)
3. [Get Summary](#get-summary)
4. [Get Loan By ID](#get-loan-by-id)
5. [Get Loan Installments](#get-loan-installments)
6. [Approve Loan](#approve-loan)
7. [Reject Loan](#reject-loan)

---

## Create Loan

Crear un nuevo préstamo.

### Endpoint

```
POST /api/v1/loans
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
  "clientId": "uuid",
  "investorId": "uuid",
  "principal": "string",
  "interestRate": "string",
  "interestType": "simple | compound",
  "interestPeriod": "monthly | annual",
  "installmentsCount": "number",
  "frequency": "daily | weekly | biweekly | monthly",
  "paymentDay": "number",
  "startDate": "ISO8601 date",
  "observation": "string"
}
```

### Diccionario de Datos

| Campo             | Tipo   | Obligatorio | Descripción          | Restricciones                                       |
| ----------------- | ------ | ----------- | -------------------- | --------------------------------------------------- |
| clientId          | uuid   | Sí          | ID del cliente       | UUID válido                                         |
| investorId        | uuid   | No          | ID del inversionista | UUID válido o null                                  |
| principal         | string | Sí          | Monto principal      | Número positivo                                     |
| interestRate      | string | Sí          | Tasa de interés      | Número >= 0                                         |
| interestType      | enum   | No          | Tipo de interés      | simple, compound (default: simple)                  |
| interestPeriod    | enum   | No          | Periodo de interés   | monthly, annual (default: monthly)                  |
| installmentsCount | number | Sí          | Número de cuotas     | Entero positivo                                     |
| frequency         | enum   | No          | Frecuencia de pago   | daily, weekly, biweekly, monthly (default: monthly) |
| paymentDay        | number | No          | Día de pago          | 1-31                                                |
| startDate         | string | No          | Fecha de inicio      | ISO8601                                             |
| observation       | string | No          | Observación          | -                                                   |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamo creado y enviado a revisión",
  "data": {
    "id": "uuid",
    "clientId": "uuid",
    "principal": "10000.00",
    "interestRate": "5.00",
    "totalDebt": "15000.00",
    "status": "pending_investor_review"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 201    | Préstamo creado       |
| 400    | Datos inválidos       |
| 401    | No autorizado         |
| 404    | Cliente no encontrado |
| 500    | Error interno         |

---

## Get All Loans

Listar préstamos. Filtra automáticamente según el rol.

### Endpoint

```
GET /api/v1/loans
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo  | Tipo   | Descripción        |
| ------ | ------ | ------------------ |
| status | string | Filtrar por estado |
| page   | number | Número de página   |
| limit  | number | Límite por página  |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamos obtenidos",
  "data": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "principal": "10000.00",
      "totalDebt": "15000.00",
      "status": "active",
      "installmentsCount": 3,
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

| Código | Descripción         |
| ------ | ------------------- |
| 200    | Préstamos obtenidos |
| 401    | No autorizado       |
| 500    | Error interno       |

---

## Get Summary

Obtener resumen financiero según el rol.

### Endpoint

```
GET /api/v1/loans/summary
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
  "message": "Resumen obtenido",
  "data": {
    "totalLoans": 5,
    "activeLoans": 3,
    "totalDebt": "50000.00",
    "totalPaid": "30000.00",
    "nextPayment": {
      "dueDate": "2024-02-01T00:00:00.000Z",
      "amount": "5000.00"
    },
    "overduePayments": 2
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción      |
| ------ | ---------------- |
| 200    | Resumen obtenido |
| 401    | No autorizado    |
| 500    | Error interno    |

---

## Get Loan By ID

Obtener detalle de un préstamo específico.

### Endpoint

```
GET /api/v1/loans/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción     |
| --------- | ---- | --------------- |
| id        | uuid | ID del préstamo |

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
  "message": "Préstamo obtenido",
  "data": {
    "id": "uuid",
    "clientId": "uuid",
    "principal": "10000.00",
    "interestRate": "5.00",
    "totalDebt": "15000.00",
    "status": "active",
    "installmentsCount": 3,
    "frequency": "monthly",
    "startDate": "2026-01-01T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo obtenido      |
| 401    | No autorizado          |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Get Loan Installments

Obtener el cronograma de pagos (cuotas) de un préstamo.

### Endpoint

```
GET /api/v1/loans/:id/installments
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción     |
| --------- | ---- | --------------- |
| id        | uuid | ID del préstamo |

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
  "message": "Cronograma obtenido",
  "data": [
    {
      "id": "uuid",
      "installmentNumber": 1,
      "dueDate": "2024-02-01T00:00:00.000Z",
      "amount": "5000.00",
      "paidAmount": "0",
      "status": "pending"
    },
    {
      "id": "uuid",
      "installmentNumber": 2,
      "dueDate": "2024-03-01T00:00:00.000Z",
      "amount": "5000.00",
      "paidAmount": "5000.00",
      "status": "paid"
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
| 200    | Cronograma obtenido    |
| 401    | No autorizado          |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Approve Loan

Aprobar un préstamo.

### Endpoint

```
PATCH /api/v1/loans/:id/approve
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción     |
| --------- | ---- | --------------- |
| id        | uuid | ID del préstamo |

### Acceso

Privado (Admin, Owner, Investor asignado)

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
  "message": "Préstamo aprobado",
  "data": {
    "id": "uuid",
    "status": "active"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo aprobado      |
| 401    | No autorizado          |
| 403    | No tiene permisos      |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Reject Loan

Rechazar un préstamo.

### Endpoint

```
PATCH /api/v1/loans/:id/reject
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción     |
| --------- | ---- | --------------- |
| id        | uuid | ID del préstamo |

### Acceso

Privado (Admin, Owner, Investor asignado)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "observation": "string"
}
```

### Diccionario de Datos

| Campo       | Tipo   | Obligatorio | Descripción       |
| ----------- | ------ | ----------- | ----------------- |
| observation | string | No          | Razón del rechazo |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamo rechazado",
  "data": {
    "id": "uuid",
    "status": "rejected"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo rechazado     |
| 401    | No autorizado          |
| 403    | No tiene permisos      |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

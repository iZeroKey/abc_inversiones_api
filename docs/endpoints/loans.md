# Prestamos

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

Crear un nuevo prestamo.

### Endpoint

```
POST /api/v1/loans
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

| Campo             | Tipo   | Obligatorio | Descripcion          | Restricciones                                       |
| ----------------- | ------ | ----------- | -------------------- | --------------------------------------------------- |
| clientId          | uuid   | Si          | ID del cliente       | UUID valido                                         |
| investorId        | uuid   | No          | ID del inversionista | UUID valido o null                                  |
| principal         | string | Si          | Monto principal      | Numero positivo                                     |
| interestRate      | string | Si          | Tasa de interes      | Numero >= 0                                         |
| interestType      | enum   | No          | Tipo de interes      | simple, compound (default: simple)                  |
| interestPeriod    | enum   | No          | Periodo de interes   | monthly, annual (default: monthly)                  |
| installmentsCount | number | Si          | Numero de cuotas     | Entero positivo                                     |
| frequency         | enum   | No          | Frecuencia de pago   | daily, weekly, biweekly, monthly (default: monthly) |
| paymentDay        | number | No          | Dia de pago          | 1-31                                                |
| startDate         | string | No          | Fecha de inicio      | ISO8601                                             |
| observation       | string | No          | Observacion          | -                                                   |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Prestamo creado y enviado a revision",
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

| Codigo | Descripcion           |
| ------ | --------------------- |
| 201    | Prestamo creado       |
| 400    | Datos invalidos       |
| 401    | No autorizado         |
| 404    | Cliente no encontrado |
| 500    | Error interno         |

---

## Get All Loans

Listar prestamos. Filtra automaticamente segun el rol.

### Endpoint

```
GET /api/v1/loans
```

### Acceso

Privado

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Parametros de Consulta

| Campo  | Tipo   | Descripcion        |
| ------ | ------ | ------------------ |
| status | string | Filtrar por estado |
| page   | number | Numero de pagina   |
| limit  | number | Limite por pagina  |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Prestamos obtenidos",
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

| Codigo | Descripcion         |
| ------ | ------------------- |
| 200    | Prestamos obtenidos |
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
| Authorization | Bearer {token} | Si          |

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

| Codigo | Descripcion      |
| ------ | ---------------- |
| 200    | Resumen obtenido |
| 401    | No autorizado    |
| 500    | Error interno    |

---

## Get Loan By ID

Obtener detalle de un prestamo especifico.

### Endpoint

```
GET /api/v1/loans/:id
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion     |
| --------- | ---- | --------------- |
| id        | uuid | ID del prestamo |

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
  "message": "Prestamo obtenido",
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

| Codigo | Descripcion            |
| ------ | ---------------------- |
| 200    | Prestamo obtenido      |
| 401    | No autorizado          |
| 404    | Prestamo no encontrado |
| 500    | Error interno          |

---

## Get Loan Installments

Obtener el cronograma de pagos (cuotas) de un prestamo.

### Endpoint

```
GET /api/v1/loans/:id/installments
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion     |
| --------- | ---- | --------------- |
| id        | uuid | ID del prestamo |

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

| Codigo | Descripcion            |
| ------ | ---------------------- |
| 200    | Cronograma obtenido    |
| 401    | No autorizado          |
| 404    | Prestamo no encontrado |
| 500    | Error interno          |

---

## Approve Loan

Aprobar un prestamo.

### Endpoint

```
PATCH /api/v1/loans/:id/approve
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion     |
| --------- | ---- | --------------- |
| id        | uuid | ID del prestamo |

### Acceso

Privado (Admin, Owner, Investor asignado)

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
  "message": "Prestamo aprobado",
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

| Codigo | Descripcion            |
| ------ | ---------------------- |
| 200    | Prestamo aprobado      |
| 401    | No autorizado          |
| 403    | No tiene permisos      |
| 404    | Prestamo no encontrado |
| 500    | Error interno          |

---

## Reject Loan

Rechazar un prestamo.

### Endpoint

```
PATCH /api/v1/loans/:id/reject
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion     |
| --------- | ---- | --------------- |
| id        | uuid | ID del prestamo |

### Acceso

Privado (Admin, Owner, Investor asignado)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Si          |
| Content-Type  | application/json | Si          |

### Cuerpo de Solicitud

```json
{
  "observation": "string"
}
```

### Diccionario de Datos

| Campo       | Tipo   | Obligatorio | Descripcion       |
| ----------- | ------ | ----------- | ----------------- |
| observation | string | No          | Razon del rechazo |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Prestamo rechazado",
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

| Codigo | Descripcion            |
| ------ | ---------------------- |
| 200    | Prestamo rechazado     |
| 401    | No autorizado          |
| 403    | No tiene permisos      |
| 404    | Prestamo no encontrado |
| 500    | Error interno          |

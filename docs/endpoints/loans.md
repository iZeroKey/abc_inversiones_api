# Préstamos

## Tabla de Contenidos

1. [Create Loan](#create-loan)
2. [Get All Loans](#get-all-loans)
3. [Get Summary](#get-summary)
4. [Get Loan By ID](#get-loan-by-id)
5. [Get Loan Installments](#get-loan-installments)
6. [Get Admin Loan Summary](#get-admin-loan-summary)
7. [Update Loan](#update-loan)
8. [Approve Loan](#approve-loan)
9. [Delete Loan](#delete-loan)
10. [Reject Loan](#reject-loan)

---

## Create Loan

Crear un nuevo préstamo.

`id` es el UUID interno del préstamo. Para UI, búsquedas y tablas operativas debe usarse `publicCode`.

Formato de códigos públicos:

| Entidad       | Formato    | Ejemplo    |
| ------------- | ---------- | ---------- |
| Préstamo      | `PR-00000` | `PR-00001` |
| Cliente       | `CL-00000` | `CL-00001` |
| Inversionista | `IN-00000` | `IN-00001` |

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
  "installmentsCount": "number",
  "frequency": "daily | weekly | biweekly | monthly",
  "startDate": "ISO8601 date",
  "observation": "string"
}
```

### Diccionario de Datos

| Campo             | Tipo   | Obligatorio | Descripción                 | Restricciones                                       |
| ----------------- | ------ | ----------- | --------------------------- | --------------------------------------------------- |
| clientId          | uuid   | Sí          | ID del cliente              | UUID válido                                         |
| investorId        | uuid   | No          | ID del inversionista        | UUID válido o null                                  |
| principal         | string | Sí          | Monto principal             | Número positivo                                     |
| interestRate      | string | Sí          | Tasa de interés por periodo | Número > 0; no se soportan préstamos sin interés    |
| installmentsCount | number | Sí          | Número de cuotas            | Entero positivo                                     |
| frequency         | enum   | No          | Frecuencia de pago          | daily, weekly, biweekly, monthly (default: monthly) |
| startDate         | string | Sí          | Fecha de inicio             | ISO8601                                             |
| observation       | string | No          | Observación                 | -                                                   |

### Regla Financiera y Cronograma

- `interestRate` se interpreta como porcentaje por periodo. Por ejemplo, `5` significa `5%`.
- El sistema solo maneja préstamos con interés; `interestRate` debe ser mayor a `0`.
- La cuota exacta se calcula con fórmula financiera: `cuota = (principal * rate) / (1 - (1 + rate) ** -installmentsCount)`.
- La cuota exacta se redondea a 2 decimales y esa cuota redondeada es la cuota oficial.
- `totalDebt` se calcula desde la cuota oficial redondeada: `cuotaOficial * installmentsCount`.
- `totalInterest` se calcula como `totalDebt - principal`.
- Todas las cuotas generadas tienen el mismo monto.
- La última cuota no se ajusta para cuadrar decimales ocultos de la fórmula financiera.
- `frequency` no cambia el importe de la cuota; solo cambia las fechas de vencimiento.
- Mensual: `startDate + i meses`, ajustando al último día válido si el mes no tiene el día original.
- Quincenal: `startDate + 15 * i días`.
- Semanal: `startDate + 7 * i días`.
- Diario: `startDate + (i + 1) días`.

Ejemplo financiero:

```txt
principal: 10000
interestRate: 5
installmentsCount: 12

Cuotas 1 a 12: 1128.25
totalDebt: 13539.00
totalInterest: 3539.00
```

No se soportan préstamos con `interestRate === 0`. Si en el futuro se agregan préstamos sin interés, se deberá definir una política específica para distribuir capital y diferencias de centavos.

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamo creado y enviado a revisión",
  "data": {
    "id": "uuid",
    "publicCode": "PR-00001",
    "clientId": "uuid",
    "clientCode": "CL-00001",
    "clientName": "Juan Perez",
    "investorId": "uuid",
    "investorCode": "IN-00001",
    "investorName": "Maria Gomez",
    "principal": "10000.00",
    "interestRate": "5.00",
    "totalDebt": "13539.00",
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

| Campo      | Tipo   | Descripción                                                                  |
| ---------- | ------ | ---------------------------------------------------------------------------- |
| status     | string | Filtrar por estado                                                           |
| clientId   | uuid   | Filtrar por UUID interno de cliente                                          |
| investorId | uuid   | Filtrar por UUID interno de inversionista                                    |
| search     | string | Buscar por `publicCode`, `clientCode`, `investorCode` o nombres relacionados |
| q          | string | Alias de `search`                                                            |
| page       | number | Número de página                                                             |
| limit      | number | Límite por página                                                            |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamos obtenidos",
  "data": [
    {
      "id": "uuid",
      "publicCode": "PR-00001",
      "clientId": "uuid",
      "clientCode": "CL-00001",
      "clientName": "Juan Perez",
      "investorId": "uuid",
      "investorCode": "IN-00001",
      "investorName": "Maria Gomez",
      "principal": "10000.00",
      "totalDebt": "13539.00",
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

| Parámetro | Tipo | Descripción               |
| --------- | ---- | ------------------------- |
| id        | uuid | UUID interno del préstamo |

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
    "publicCode": "PR-00001",
    "clientId": "uuid",
    "clientCode": "CL-00001",
    "clientName": "Juan Perez",
    "investorId": "uuid",
    "investorCode": "IN-00001",
    "investorName": "Maria Gomez",
    "principal": "10000.00",
    "interestRate": "5.00",
    "totalDebt": "13539.00",
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

## Get Admin Loan Summary

Tabla resumen administrativa de préstamos para la vista tipo resumen del frontend.

### Endpoint

```
GET /api/v1/loans/admin-summary
```

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Resumen administrativo de préstamos obtenido",
  "data": [
    {
      "id": "uuid",
      "publicCode": "PR-00001",
      "clientId": "uuid",
      "clientCode": "CL-00001",
      "clientName": "Juan Perez",
      "investorId": "uuid",
      "investorCode": "IN-00001",
      "investorName": "Maria Gomez",
      "creditDate": "2026-05-08T00:00:00.000-05:00",
      "principal": "10000.00",
      "frequency": "monthly",
      "interestRate": "5.00",
      "paidAmount": "3000.00",
      "totalInterest": "3539.00",
      "remainingDebt": "10539.00",
      "remainingInstallments": 7,
      "totalDebt": "13539.00",
      "status": "active",
      "createdAt": "2026-05-08T00:00:00.000-05:00"
    }
  ],
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                       |
| ------ | --------------------------------- |
| 200    | Resumen administrativo obtenido   |
| 401    | No autorizado                     |
| 403    | No tiene permisos administrativos |
| 500    | Error interno                     |

---

## Update Loan

Editar un préstamo por corrección operativa. Si el préstamo ya tiene cronograma, se recalculan deuda y cuotas con la regla financiera vigente y se reaplican los pagos confirmados no eliminados en orden cronológico. Si los pagos superan la nueva deuda, el exceso queda expuesto en `overpaidAmount`.

### Endpoint

```
PATCH /api/v1/loans/:id
```

### Acceso

Privado (Admin, Owner)

### Cuerpo de Solicitud

```json
{
  "clientId": "uuid",
  "investorId": "uuid",
  "principal": "12000.00",
  "interestRate": "4.50",
  "installmentsCount": 10,
  "frequency": "monthly",
  "startDate": "2026-02-01T00:00:00.000Z",
  "observation": "Corrección de monto"
}
```

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamo actualizado",
  "data": {
    "id": "uuid",
    "publicCode": "PR-00001",
    "principal": "12000.00",
    "totalDebt": "14955.30",
    "overpaidAmount": "0.00",
    "status": "active"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo actualizado   |
| 400    | Datos inválidos        |
| 401    | No autorizado          |
| 403    | No tiene permisos      |
| 404    | Préstamo no encontrado |

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

### Reglas

- Inversionista asignado: puede aprobar un préstamo en `pending_investor_review`; el préstamo pasa a `pending_admin_review`.
- Admin/Owner: puede activar directamente préstamos en `draft`, `pending_investor_review`, `pending_admin_review`, `rejected`, `defaulted` o `active`.
- Si el préstamo ya tiene cuotas, la aprobación administrativa no duplica el cronograma.
- Si el préstamo no tiene cuotas, se generan usando la regla financiera y de fechas indicada en [Create Loan](#create-loan).
- Un préstamo `paid` responde exitosamente como ya pagado y no se modifica.

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
  "message": "Préstamo activado y cuotas generadas",
  "data": {
    "loan": {
      "id": "uuid",
      "publicCode": "PR-00001",
      "clientCode": "CL-00001",
      "clientName": "Juan Perez",
      "investorCode": "IN-00001",
      "investorName": "Maria Gomez",
      "status": "active",
      "totalDebt": "13539.00"
    },
    "installments": [
      {
        "installmentNumber": 1,
        "dueDate": "2026-06-08T00:00:00.000-05:00",
        "amount": "1128.25",
        "paidAmount": "0.00",
        "status": "pending"
      }
    ]
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

## Delete Loan

Eliminar lógicamente un préstamo creado por error. No borra cuotas, pagos ni auditoría; el préstamo queda en estado `deleted`, se oculta de listados normales y bloquea nuevos pagos o vouchers.

### Endpoint

```
DELETE /api/v1/loans/:id
```

### Acceso

Privado (Admin, Owner)

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamo eliminado",
  "data": {
    "id": "uuid",
    "status": "deleted",
    "deletedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo eliminado     |
| 401    | No autorizado          |
| 403    | No tiene permisos      |
| 404    | Préstamo no encontrado |

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

### Reglas

- Inversionista asignado: puede rechazar únicamente préstamos en `pending_investor_review`.
- Admin/Owner: puede rechazar préstamos en cualquier estado salvo `paid`.
- Si el préstamo ya está `rejected`, la respuesta es exitosa y no se modifica.

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

# Préstamos

## Tabla de Contenidos

1. [Create Loan](#create-loan)
2. [Get All Loans](#get-all-loans)
3. [Get Summary](#get-summary)
4. [Get Loan By ID](#get-loan-by-id)
5. [Get Loan Bundle](#get-loan-bundle)
6. [Get Loan Installments](#get-loan-installments)
7. [Get Admin Loan Summary](#get-admin-loan-summary)
8. [Update Loan](#update-loan)
9. [Approve Loan](#approve-loan)
10. [Delete Loan](#delete-loan)
11. [Reject Loan](#reject-loan)

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
  "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
  "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
  "principal": "10000.00",
  "interestRate": "5.00",
  "installmentsCount": 12,
  "frequency": "monthly",
  "startDate": "2026-06-08T00:00:00.000Z",
  "name": "Préstamo #PR-00001",
  "observation": "Préstamo regular con cuota mensual"
}
```

### Diccionario de Datos

| Campo             | Tipo   | Obligatorio | Descripción                  | Restricciones                                                                     |
| ----------------- | ------ | ----------- | ---------------------------- | --------------------------------------------------------------------------------- |
| clientId          | uuid   | Sí          | ID del cliente               | UUID de usuario con rol `"client"`.                                               |
| investorId        | uuid   | No          | ID del inversionista         | UUID de usuario con rol `"investor"` o `null`/`undefined`.                        |
| principal         | string | Sí          | Monto principal solicitado   | Debe ser un valor numérico positivo.                                              |
| interestRate      | string | Sí          | Tasa de interés por periodo  | Debe ser un valor numérico mayor a `0`.                                           |
| interestType      | string | No          | Tipo de interés              | Literal `"simple"` (default).                                                     |
| interestPeriod    | string | No          | Periodo del interés          | Literal `"monthly"` (default).                                                    |
| installmentsCount | number | Sí          | Número total de cuotas       | Entero positivo entre `1` y `120` (inclusive).                                    |
| frequency         | enum   | No          | Frecuencia de pago           | `"daily"`, `"weekly"`, `"biweekly"`, `"monthly"` (default: `"monthly"`).          |
| name              | string | No          | Título o nombre del préstamo | Máximo 255 caracteres. Si no se envía, se genera como `"Préstamo #{publicCode}"`. |
| startDate         | string | Sí          | Fecha de inicio              | Formato ISO8601 con offset de zona horaria.                                       |
| observation       | string | No          | Notas u observaciones        | -                                                                                 |

### Regla Financiera y Cronograma

- `interestRate` se interpreta como porcentaje por periodo (por ejemplo, `5.00` equivale a `5%`).
- La cuota oficial exacta se calcula con la fórmula financiera de amortización constante: `cuota = (principal * rate) / (1 - (1 + rate) ** -installmentsCount)`, redondeada a 2 decimales.
- `totalDebt` se calcula como `cuotaOficial * installmentsCount`.
- `totalInterest` se calcula como `totalDebt - principal`.
- La frecuencia (`frequency`) define el cálculo de fechas de vencimiento para las cuotas (`installments`):
  - `"daily"`: `startDate + (i + 1) días`.
  - `"weekly"`: `startDate + 7 * i días`.
  - `"biweekly"`: `startDate + 15 * i días`.
  - `"monthly"`: `startDate + i meses` (ajustando al último día válido si el mes de destino es más corto).

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamo creado y enviado a revisión",
  "data": {
    "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "publicCode": "PR-00001",
    "name": "Préstamo #PR-00001",
    "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
    "client": {
      "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "publicCode": "CL-00001",
      "firstName": "Juan",
      "lastName": "Pérez",
      "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
    },
    "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
    "investor": {
      "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "publicCode": "IN-00001",
      "firstName": "María",
      "lastName": "Gómez",
      "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
    },
    "principal": "10000.00",
    "interestRate": "5.00",
    "totalDebt": "11282.52",
    "status": "pending_investor_review"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 201    | Préstamo creado       |
| 400    | Datos inválidos       |
| 401    | No autenticado        |
| 404    | Cliente no encontrado |
| 500    | Error interno         |

---

## Get All Loans

Listar préstamos con paginación y filtros. Filtra automáticamente según el rol del usuario autenticado (clientes sólo ven sus préstamos, inversionistas sólo los suyos).

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

| Campo      | Tipo   | Obligatorio | Descripción                                                                              |
| ---------- | ------ | ----------- | ---------------------------------------------------------------------------------------- |
| status     | string | No          | Filtrar por estado del préstamo (ej. `"active"`, `"paid"`, `"rejected"`, `"defaulted"`). |
| clientId   | uuid   | No          | Filtrar por ID del cliente (ignorado para clientes).                                     |
| investorId | uuid   | No          | Filtrar por ID del inversionista (ignorado para inversionistas).                         |
| from       | string | No          | Fecha ISO8601 inicial para filtrar por fecha de creación del préstamo.                   |
| to         | string | No          | Fecha ISO8601 final para filtrar por fecha de creación del préstamo.                     |
| search     | string | No          | Buscar coincidencia parcial en códigos públicos, nombres del cliente/inversionista o montos (principal). |
| q          | string | No          | Alias para `search`.                                                                     |
| page       | number | No          | Número de página (default: `1`).                                                         |
| limit      | number | No          | Límite por página (default: `20`, máximo: `100`).                                        |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamos obtenidos",
  "data": [
    {
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "name": "Préstamo #PR-00001",
      "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "client": {
        "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
        "publicCode": "CL-00001",
        "firstName": "Juan",
        "lastName": "Pérez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "investor": {
        "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
        "publicCode": "IN-00001",
        "firstName": "María",
        "lastName": "Gómez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "principal": "10000.00",
      "totalDebt": "11282.52",
      "status": "active",
      "installmentsCount": 12,
      "totalPaid": "940.21",
      "remainingDebt": "10342.31",
      "remainingInstallments": 11,
      "nextPaymentDate": "2026-06-08T00:00:00.000Z",
      "nextPaymentAmount": "940.21",
      "nextInstallment": {
        "dueDate": "2026-06-08T00:00:00.000Z",
        "amount": "940.21"
      },
      "progress": 8,
      "createdAt": "2026-05-22T04:26:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    },
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción         |
| ------ | ------------------- |
| 200    | Préstamos obtenidos |
| 401    | No autenticado      |
| 500    | Error interno       |

---

## Get Summary

Obtener el resumen financiero consolidado según el rol del usuario autenticado.

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

### Respuesta Exitosa (Según Rol)

#### Rol: Cliente

```json
{
  "success": true,
  "message": "Resumen de cuenta cliente",
  "data": {
    "stats": {
      "totalPrincipal": "10000.00",
      "totalDebt": "11282.52"
    },
    "nextPayment": {
      "date": "2026-06-08T00:00:00.000Z",
      "amount": "940.21"
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

#### Rol: Inversionista

```json
{
  "success": true,
  "message": "Resumen de inversiones",
  "data": {
    "investedAmount": "50000.00",
    "expectedRevenue": "56412.60",
    "activeLoans": 5,
    "totalDebt": "56412.60",
    "paidLoans": 2,
    "totalPaid": "1000.00",
    "overdue": {
      "overdueCount": 2,
      "overdueAmount": "1880.42"
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

#### Rol: Admin / Owner

```json
{
  "success": true,
  "message": "Dashboard administrativo",
  "data": {
    "totalActiveLoans": 15,
    "activeLoans": 15,
    "totalPortfolio": "150000.00",
    "totalDebt": "150000.00",
    "overdueGlobal": "4500.00",
    "overdueAmount": "4500.00",
    "paidLoans": 0,
    "totalPaid": "0.00"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción      |
| ------ | ---------------- |
| 200    | Resumen obtenido |
| 401    | No autenticado   |
| 500    | Error interno    |

---

## Get Loan By ID

Obtener detalle de un préstamo específico por su ID (UUID).

### Endpoint

```
GET /api/v1/loans/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción               |
| --------- | ---- | ----------- | ------------------------- |
| id        | uuid | Sí          | UUID interno del préstamo |

### Acceso

Privado (Cualquier participante del préstamo o Admin/Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Detalle de préstamo obtenido",
  "data": {
    "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "publicCode": "PR-00001",
    "name": "Préstamo #PR-00001",
    "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
    "client": {
      "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "publicCode": "CL-00001",
      "firstName": "Juan",
      "lastName": "Pérez",
      "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
    },
    "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
    "investor": {
      "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "publicCode": "IN-00001",
      "firstName": "María",
      "lastName": "Gómez",
      "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
    },
    "principal": "10000.00",
    "interestRate": "5.00",
    "totalDebt": "11282.52",
    "status": "active",
    "installmentsCount": 12,
    "frequency": "monthly",
    "startDate": "2026-05-08T00:00:00.000Z",
    "createdAt": "2026-05-08T00:00:00.000Z",
    "updatedAt": "2026-05-08T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo obtenido      |
| 401    | No autenticado         |
| 403    | Sin acceso             |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Get Loan Bundle

Obtener en una sola respuesta el detalle del préstamo, cronograma, pagos confirmados/revertidos no eliminados y vouchers no eliminados. Este endpoint evita consultas repetidas desde clientes que necesitan abrir el detalle completo de un préstamo.

### Endpoint

```
GET /api/v1/loans/:id/bundle
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción               |
| --------- | ---- | ----------- | ------------------------- |
| id        | uuid | Sí          | UUID interno del préstamo |

### Acceso

Privado (Cualquier participante del préstamo o Admin/Owner)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Bundle de préstamo obtenido",
  "data": {
    "loan": {
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "name": "Préstamo #PR-00001",
      "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "client": {
        "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
        "publicCode": "CL-00001",
        "firstName": "Juan",
        "lastName": "Pérez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "investor": {
        "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
        "publicCode": "IN-00001",
        "firstName": "María",
        "lastName": "Gómez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "principal": "10000.00",
      "interestRate": "5.00",
      "totalDebt": "11282.52",
      "status": "active"
    },
    "installments": [
      {
        "id": "uuid-installment-1",
        "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "installmentNumber": 1,
        "dueDate": "2026-06-08T00:00:00.000Z",
        "amount": "940.21",
        "paidAmount": "0.00",
        "status": "pending"
      }
    ],
    "payments": [
      {
        "id": "uuid-payment-1",
        "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "amount": "940.21",
        "paymentDate": "2026-06-08T00:00:00.000Z",
        "method": "transfer",
        "status": "confirmed",
        "evidenceUrl": "https://signed-url-temporal.example"
      }
    ],
    "vouchers": [
      {
        "id": "uuid-voucher-1",
        "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "amount": "940.21",
        "operationId": "OP-12345",
        "status": "owner_approved",
        "evidenceUrl": "https://signed-url-temporal.example"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Notas de Privacidad

- `payments[].evidenceUrl` y `vouchers[].evidenceUrl` pueden ser URLs firmadas temporales.
- El cliente debe tratar esta respuesta como sensible y evitar persistirla localmente.

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Bundle obtenido        |
| 401    | No autenticado         |
| 403    | Sin acceso             |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Get Loan Installments

Obtener el cronograma detallado de cuotas de un préstamo.

### Endpoint

```
GET /api/v1/loans/:id/installments
```

### Parámetros de Consulta

| Campo | Tipo   | Obligatorio | Descripción                                       |
| ----- | ------ | ----------- | ------------------------------------------------- |
| page  | number | No          | Número de página (default: `1`, máximo: `200`).   |
| limit | number | No          | Límite por página (default: `20`, máximo: `200`). |

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción     |
| --------- | ---- | ----------- | --------------- |
| id        | uuid | Sí          | ID del préstamo |

### Acceso

Privado (Participantes del préstamo o Admin/Owner)

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
      "id": "uuid-installment-1",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "installmentNumber": 1,
      "dueDate": "2026-06-08T00:00:00.000Z",
      "amount": "940.21",
      "paidAmount": "0.00",
      "status": "pending",
      "createdAt": "2026-05-22T04:26:00.000Z",
      "updatedAt": "2026-05-22T04:26:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    },
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Cronograma obtenido    |
| 401    | No autenticado         |
| 403    | Sin acceso             |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Get Admin Loan Summary

Obtener una lista consolidada y detallada de préstamos para el dashboard administrativo, incluyendo datos financieros acumulados de pagos y deudas pendientes.

Soporta paginación y filtros.

### Endpoint

```
GET /api/v1/loans/admin-summary
```

### Parámetros de Consulta

| Campo  | Tipo   | Obligatorio | Descripción                                                 |
| ------ | ------ | ----------- | ----------------------------------------------------------- |
| page   | number | No          | Número de página (default: `1`).                            |
| limit  | number | No          | Límite por página (default: `20`, máximo: `100`).           |
| status | string | No          | Filtrar por estado del préstamo (ej. `"active"`, `"paid"`). |
| from   | string | No          | Fecha ISO8601 inicial para filtrar por fecha de creación.   |
| to     | string | No          | Fecha ISO8601 final para filtrar por fecha de creación.     |
| q      | string | No          | Buscar coincidencia parcial en códigos públicos o nombres.  |

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
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "client": {
        "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
        "publicCode": "CL-00001",
        "firstName": "Juan",
        "lastName": "Pérez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "investor": {
        "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
        "publicCode": "IN-00001",
        "firstName": "María",
        "lastName": "Gómez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "creditDate": "2026-05-08T00:00:00.000Z",
      "principal": "10000.00",
      "frequency": "monthly",
      "interestRate": "5.00",
      "totalDebt": "11282.52",
      "status": "active",
      "paidAmount": "940.21",
      "totalInterest": "1282.52",
      "remainingDebt": "10342.31",
      "remainingInstallments": 11,
      "createdAt": "2026-05-08T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    },
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                        |
| ------ | ---------------------------------- |
| 200    | Resumen administrativo obtenido    |
| 401    | No autenticado                     |
| 403    | No autorizado (Sin permisos Admin) |
| 500    | Error interno                      |

---

## Update Loan

Editar los parámetros de un préstamo. Si el préstamo ya tiene un cronograma activo, se recalculan la deuda y cuotas vigentes y se reaplican todos los pagos confirmados no eliminados en orden cronológico. Si los pagos registrados superan la nueva deuda calculada, el excedente se expone en `overpaidAmount`.

### Endpoint

```
PATCH /api/v1/loans/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción               |
| --------- | ---- | ----------- | ------------------------- |
| id        | uuid | Sí          | ID del préstamo a editar. |

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
  "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
  "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
  "principal": "12000.00",
  "interestRate": "4.50",
  "installmentsCount": 10,
  "frequency": "monthly",
  "startDate": "2026-02-01T00:00:00.000Z",
  "name": "Préstamo #PR-00001 - Reajuste",
  "observation": "Reajuste de tasa pactado con cliente"
}
```

### Diccionario de Datos (Todos Opcionales)

| Campo             | Tipo   | Descripción                    | Restricciones                                     |
| ----------------- | ------ | ------------------------------ | ------------------------------------------------- |
| clientId          | uuid   | ID del cliente                 | UUID de usuario con rol `"client"`.               |
| investorId        | uuid   | ID del inversionista (o null)  | UUID de usuario con rol `"investor"` o `null`.    |
| principal         | string | Nuevo monto principal          | Debe ser numérico positivo.                       |
| interestRate      | string | Nueva tasa de interés          | Debe ser numérico mayor a `0`.                    |
| installmentsCount | number | Nuevo número de cuotas         | Entero positivo entre `1` y `120`.                |
| frequency         | enum   | Frecuencia de pago             | `"daily"`, `"weekly"`, `"biweekly"`, `"monthly"`. |
| startDate         | string | Fecha de inicio                | Formato ISO8601.                                  |
| name              | string | Título o nombre del préstamo   | Máximo 255 caracteres.                            |
| observation       | string | Notas o explicaciones (o null) | -                                                 |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Préstamo actualizado correctamente",
  "data": {
    "loan": {
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "name": "Préstamo #PR-00001 - Reajuste",
      "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "client": {
        "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
        "publicCode": "CL-00001",
        "firstName": "Juan",
        "lastName": "Pérez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "investor": {
        "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
        "publicCode": "IN-00001",
        "firstName": "María",
        "lastName": "Gómez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "principal": "12000.00",
      "interestRate": "4.50",
      "totalDebt": "13020.30",
      "status": "active",
      "installmentsCount": 10,
      "frequency": "monthly",
      "startDate": "2026-02-01T00:00:00.000Z",
      "createdAt": "2026-05-08T00:00:00.000Z",
      "updatedAt": "2026-05-22T04:26:00.000Z"
    },
    "overpaidAmount": "0.00"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo actualizado   |
| 400    | Datos inválidos        |
| 401    | No autenticado         |
| 403    | No autorizado          |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Approve Loan

Aprobar y activar un préstamo.

### Reglas

- **Inversionista asignado**: Si el préstamo se encuentra en `pending_investor_review`, puede realizar la aprobación, lo que cambiará el estado a `pending_admin_review`.
- **Administrador / Dueño**: Puede activar préstamos que estén en estados `draft`, `pending_investor_review`, `pending_admin_review`, `rejected`, `defaulted` o `active`.
- Si el préstamo ya cuenta con cuotas, la activación de Admin no duplica el cronograma.
- Si el préstamo no tiene cuotas, se generan automáticamente en base a la regla financiera de amortización.
- Si el préstamo ya está `paid`, se responde exitosamente de inmediato indicando que ya está pagado sin realizar cambios.

### Endpoint

```
PATCH /api/v1/loans/:id/approve
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                        |
| --------- | ---- | ----------- | ---------------------------------- |
| id        | uuid | Sí          | ID del préstamo a aprobar/activar. |

### Acceso

Privado (Admin, Owner, o Inversionista asignado)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

#### Caso 1: Aprobado por Inversionista (Cambia a `pending_admin_review`)

```json
{
  "success": true,
  "message": "Préstamo aprobado por inversionista. Pendiente de Admin.",
  "data": {
    "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "publicCode": "PR-00001",
    "name": "Préstamo #PR-00001",
    "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
    "client": {
      "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "publicCode": "CL-00001",
      "firstName": "Juan",
      "lastName": "Pérez",
      "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
    },
    "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
    "investor": {
      "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "publicCode": "IN-00001",
      "firstName": "María",
      "lastName": "Gómez",
      "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
    },
    "principal": "10000.00",
    "interestRate": "5.00",
    "totalDebt": "11282.52",
    "status": "pending_admin_review",
    "createdAt": "2026-05-08T00:00:00.000Z",
    "updatedAt": "2026-05-22T04:26:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

#### Caso 2: Activado por Admin (Genera cuotas y cambia a `active`)

```json
{
  "success": true,
  "message": "Préstamo activado y cuotas generadas",
  "data": {
    "loan": {
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "name": "Préstamo #PR-00001",
      "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
      "client": {
        "id": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
        "publicCode": "CL-00001",
        "firstName": "Juan",
        "lastName": "Pérez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "investorId": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
      "investor": {
        "id": "19f94eb9-4fa2-47ef-ba22-87a27ebca930",
        "publicCode": "IN-00001",
        "firstName": "María",
        "lastName": "Gómez",
        "avatarUrl": "https://supabase.co/storage/v1/object/sign/avatars/..."
      },
      "principal": "10000.00",
      "interestRate": "5.00",
      "totalDebt": "11282.52",
      "status": "active"
    },
    "installments": [
      {
        "id": "uuid-installment-1",
        "installmentNumber": 1,
        "dueDate": "2026-06-08T00:00:00.000Z",
        "amount": "940.21",
        "paidAmount": "0.00",
        "status": "pending"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

#### Caso 3: Activado por Admin pero ya estaba activo (Sin volver a crear cuotas)

```json
{
  "success": true,
  "message": "Préstamo ya se encuentra activo",
  "data": {
    "loan": {
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "status": "active"
    },
    "installments": [ ... ]
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

#### Caso 4: Intentar activar un préstamo ya pagado (`paid`)

```json
{
  "success": true,
  "message": "Préstamo ya se encuentra pagado",
  "data": {
    "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "status": "paid"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Aprobación exitosa     |
| 400    | Operación no permitida |
| 401    | No autenticado         |
| 403    | Sin permisos           |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Delete Loan

Eliminar lógicamente un préstamo creado por error. El préstamo pasa al estado `"deleted"`, se oculta de las búsquedas normales y bloquea cualquier registro de pago posterior.

### Endpoint

```
DELETE /api/v1/loans/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                 |
| --------- | ---- | ----------- | --------------------------- |
| id        | uuid | Sí          | ID del préstamo a eliminar. |

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
  "message": "Préstamo eliminado correctamente",
  "data": {
    "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "publicCode": "PR-00001",
    "clientId": "4cb37f2a-7bf3-4fb3-8182-9988ffaa0021",
    "status": "deleted",
    "deletedAt": "2026-05-22T04:26:00.000Z",
    "updatedAt": "2026-05-22T04:26:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción            |
| ------ | ---------------------- |
| 200    | Préstamo desactivado   |
| 401    | No autenticado         |
| 403    | No autorizado          |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Reject Loan

Rechazar una solicitud de préstamo.

### Reglas

- **Inversionista asignado**: Puede rechazar un préstamo únicamente si está en `pending_investor_review`.
- **Administrador / Dueño**: Puede rechazar préstamos en cualquier estado excepto cuando ya esté pagado (`paid`).
- Si el préstamo ya se encuentra rechazado (`rejected`), el endpoint responde de inmediato de forma exitosa sin alterar los datos.

### Endpoint

```
PATCH /api/v1/loans/:id/reject
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                 |
| --------- | ---- | ----------- | --------------------------- |
| id        | uuid | Sí          | ID del préstamo a rechazar. |

### Acceso

Privado (Admin, Owner, o Inversionista asignado)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "observation": "Historial crediticio con alertas externas"
}
```

### Diccionario de Datos

| Campo       | Tipo   | Obligatorio | Descripción                     |
| ----------- | ------ | ----------- | ------------------------------- |
| observation | string | No          | Razón del rechazo del préstamo. |

### Respuesta Exitosa

#### Caso 1: Préstamo rechazado con éxito

```json
{
  "success": true,
  "message": "Préstamo rechazado",
  "data": {
    "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "publicCode": "PR-00001",
    "status": "rejected",
    "observation": "Historial crediticio con alertas externas"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

#### Caso 2: Préstamo ya se encontraba rechazado

```json
{
  "success": true,
  "message": "Préstamo ya se encuentra rechazado",
  "data": {
    "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "publicCode": "PR-00001",
    "status": "rejected"
  },
  "meta": {
    "timestamp": "2026-05-22T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción             |
| ------ | ----------------------- |
| 200    | Préstamo rechazado      |
| 400    | Datos o estado inválido |
| 401    | No autenticado          |
| 403    | No autorizado           |
| 404    | Préstamo no encontrado  |
| 500    | Error interno           |

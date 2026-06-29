# Pagos

## Tabla de Contenidos

1. [Register Payment](#register-payment)
2. [Get Payments By Loan](#get-payments-by-loan)
3. [Update Payment](#update-payment)
4. [Delete Payment](#delete-payment)

---

## Register Payment

Registrar un nuevo pago manual y aplicarlo al cronograma del préstamo. El pago se marca como `"confirmed"` directamente y se distribuye entre las cuotas pendientes (`"pending"` y `"overdue"`), ordenadas cronológicamente por fecha de vencimiento (`dueDate`).

El endpoint acepta `application/json` si no se incluye evidencia física, o `multipart/form-data` si se desea adjuntar un archivo en el campo `evidence`.

### Reglas de Negocio

- El préstamo correspondiente debe existir, no estar borrado y tener el estado `"active"`.
- La deuda pendiente real se calcula dinámicamente sumando el saldo pendiente (`amount - paidAmount`) de todas las cuotas activas.
- Si el monto a registrar supera la deuda pendiente total del préstamo, se rechazará la operación con un error `400` (no se admiten pagos excedentes iniciales de forma directa por este endpoint).

### Endpoint

```
POST /api/v1/payments
```

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor                                  | Obligatorio |
| ------------- | -------------------------------------- | ----------- |
| Authorization | Bearer {token}                         | Sí          |
| Content-Type  | application/json o multipart/form-data | Sí          |

### Cuerpo de Solicitud (Campos de Formulario / JSON)

```json
{
  "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
  "installmentId": "uuid-installment-1",
  "amount": "940.21",
  "paymentDate": "2026-06-08T04:26:00.000Z",
  "method": "transfer",
  "reference": "OP-987654",
  "observation": "Pago de primera cuota vía BCP"
}
```

### Diccionario de Datos

| Campo         | Tipo   | Obligatorio | Descripción                            | Restricciones                                                       |
| ------------- | ------ | ----------- | -------------------------------------- | ------------------------------------------------------------------- |
| loanId        | uuid   | Sí          | ID del préstamo.                       | UUID válido de préstamo `"active"`.                                 |
| installmentId | uuid   | No          | ID de la cuota específica.             | UUID de cuota válido.                                               |
| amount        | string | Sí          | Importe del pago a registrar.          | Valor numérico positivo mayor a `0`.                                |
| paymentDate   | string | No          | Fecha del pago.                        | ISO8601 (default: fecha actual).                                    |
| method        | enum   | No          | Método empleado para el pago.          | `"cash"`, `"transfer"`, `"deposit"`, `"other"` (default: `"cash"`). |
| reference     | string | No          | Referencia u operación del movimiento. | -                                                                   |
| observation   | string | No          | Notas del pago.                        | -                                                                   |
| evidence      | file   | No          | Archivo adjunto (evidencia de pago).   | JPEG, PNG o WebP (máximo 5MB).                                      |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Pago registrado y aplicado correctamente",
  "data": {
    "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
    "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "installmentId": "uuid-installment-1",
    "voucherId": null,
    "amount": "940.21",
    "paymentDate": "2026-06-08T04:26:00.000Z",
    "method": "transfer",
    "reference": "OP-987654",
    "observation": "Pago de primera cuota vía BCP",
    "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
    "registeredById": "uuid-admin-id",
    "status": "confirmed",
    "createdAt": "2026-06-08T04:26:00.000Z",
    "updatedAt": "2026-06-08T04:26:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-06-08T04:26:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                                          |
| ------ | ---------------------------------------------------- |
| 201    | Pago registrado y aplicado correctamente             |
| 400    | Datos inválidos, préstamo no activo o pago excedente |
| 401    | No autenticado                                       |
| 403    | No autorizado                                        |
| 404    | Préstamo no encontrado                               |
| 500    | Error interno                                        |

---

## Get Payments By Loan

Obtener la lista histórica de pagos registrados (no eliminados) de un préstamo específico.

### Endpoint

```
GET /api/v1/payments/loan/:loanId
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                  |
| --------- | ---- | ----------- | ---------------------------- |
| loanId    | uuid | Sí          | ID del préstamo a consultar. |

### Parámetros de Consulta

| Campo  | Tipo   | Obligatorio | Descripción                                                |
| ------ | ------ | ----------- | ---------------------------------------------------------- |
| page   | number | No          | Número de página (default: `1`).                           |
| limit  | number | No          | Límite por página (default: `20`, máximo: `100`).          |
| from   | string | No          | Fecha ISO8601 inicial para filtrar por fecha de pago.      |
| to     | string | No          | Fecha ISO8601 final para filtrar por fecha de pago.        |
| method | string | No          | Filtrar por método de pago (`"cash"`, `"transfer"`, etc.). |

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
  "message": "Pagos obtenidos",
  "data": [
    {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "installmentId": "uuid-installment-1",
      "voucherId": null,
      "amount": "940.21",
      "paymentDate": "2026-06-08T04:26:00.000Z",
      "method": "transfer",
      "reference": "OP-987654",
      "observation": "Pago de primera cuota vía BCP",
      "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
      "registeredById": "uuid-admin-id",
      "status": "confirmed",
      "createdAt": "2026-06-08T04:26:00.000Z",
      "updatedAt": "2026-06-08T04:26:00.000Z",
      "deletedAt": null
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
| 200    | Pagos obtenidos        |
| 401    | No autenticado         |
| 403    | Sin acceso             |
| 404    | Préstamo no encontrado |
| 500    | Error interno          |

---

## Update Payment

Actualizar la información de un pago manual registrado. Al modificar el monto o fecha, el sistema actualiza el registro, recalculando la aplicación de todos los pagos cronológicamente. Si tras el recálculo se produce un exceso de dinero abonado, este se reportará en `overpaidAmount`.

### Endpoint

```
PATCH /api/v1/payments/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción               |
| --------- | ---- | ----------- | ------------------------- |
| id        | uuid | Sí          | ID del pago a actualizar. |

### Acceso

Privado (Admin, Owner)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud (Campos Opcionales)

```json
{
  "amount": "900.00",
  "paymentDate": "2026-06-08T04:26:00.000Z",
  "method": "transfer",
  "reference": "OP-987654-REV",
  "observation": "Corrección de monto según conciliación"
}
```

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Pago actualizado correctamente",
  "data": {
    "payment": {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "installmentId": "uuid-installment-1",
      "voucherId": null,
      "amount": "900.00",
      "paymentDate": "2026-06-08T04:26:00.000Z",
      "method": "transfer",
      "reference": "OP-987654-REV",
      "observation": "Corrección de monto según conciliación",
      "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
      "registeredById": "uuid-admin-id",
      "status": "confirmed",
      "createdAt": "2026-06-08T04:26:00.000Z",
      "updatedAt": "2026-05-22T04:28:00.000Z",
      "deletedAt": null
    },
    "loan": {
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "status": "active",
      "totalDebt": "11282.52"
    },
    "overpaidAmount": "0.00"
  },
  "meta": {
    "timestamp": "2026-05-22T04:28:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                                   |
| ------ | --------------------------------------------- |
| 200    | Pago actualizado correctamente                |
| 400    | Préstamo asociado eliminado o datos inválidos |
| 401    | No autenticado                                |
| 403    | No autorizado                                 |
| 404    | Pago no encontrado                            |
| 500    | Error interno                                 |

---

## Delete Payment

Eliminar lógicamente un pago registrado. Se establece el estado del pago en `"reversed"`, se marca su fecha de borrado (`deletedAt`) y se recalcula el estado de deudas y saldos en las cuotas del préstamo.

### Endpoint

```
DELETE /api/v1/payments/:id
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción             |
| --------- | ---- | ----------- | ----------------------- |
| id        | uuid | Sí          | ID del pago a eliminar. |

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
  "message": "Pago eliminado correctamente",
  "data": {
    "payment": {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "status": "reversed",
      "deletedAt": "2026-05-22T04:29:00.000Z"
    },
    "loan": {
      "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "publicCode": "PR-00001",
      "status": "active",
      "totalDebt": "11282.52"
    },
    "overpaidAmount": "0.00"
  },
  "meta": {
    "timestamp": "2026-05-22T04:29:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                                  |
| ------ | -------------------------------------------- |
| 200    | Pago eliminado correctamente                 |
| 400    | Operación no permitida o préstamo ya borrado |
| 401    | No autenticado                               |
| 403    | No autorizado                                |
| 404    | Pago no encontrado                           |
| 500    | Error interno                                |

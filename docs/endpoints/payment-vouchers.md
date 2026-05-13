# Payment Vouchers

## Tabla de Contenidos

1. [Analyze Voucher](#analyze-voucher)
2. [Submit Voucher](#submit-voucher)
3. [Get Vouchers](#get-vouchers)
4. [Check Operation ID](#check-operation-id)
5. [Process Voucher](#process-voucher)
6. [Update Voucher](#update-voucher)
7. [Delete Voucher](#delete-voucher)

---

## Analyze Voucher

Analizar un comprobante en backend con OCR y devolver JSON sugerido. No persiste la imagen ni crea el voucher.

Usa modo **buffer** (busboy) porque Google Vision API requiere la imagen completa.

### Endpoint

```
POST /api/v1/payment-vouchers/analyze
```

### Acceso

Privado (Client)

### Encabezados

| Encabezado    | Valor               | Obligatorio |
| ------------- | ------------------- | ----------- |
| Authorization | Bearer {token}      | Sí          |
| Content-Type  | multipart/form-data | Sí          |

### Cuerpo de Solicitud

| Campo    | Tipo | Descripción                                     |
| -------- | ---- | ----------------------------------------------- |
| evidence | file | Imagen del voucher (JPEG, PNG, WebP, max 1.5MB) |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Análisis completado",
  "data": {
    "operationId": "ABC123456",
    "amount": "5000.00",
    "operationDate": "2026-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                         |
| ------ | ----------------------------------- |
| 200    | Análisis completado                 |
| 400    | Archivo inválido o análisis fallido |
| 401    | No autorizado                       |
| 413    | Archivo excede el límite de 1.5MB   |
| 500    | Error interno                       |

---

## Submit Voucher

Subir un nuevo comprobante de pago (Voucher) con la imagen y los datos finales confirmados por el cliente. No se aceptan vouchers sobre préstamos eliminados.

El cliente no envía ni escoge método de pago en vouchers. Si el préstamo tiene un inversionista con cuenta de acceso activa, el voucher queda en `pending_investor_review`; si no tiene inversionista con acceso, queda directamente en `pending_admin_review`.

Usa modo **stream** (busboy): los bytes de la imagen fluyen directamente a Supabase Storage sin acumularse en RAM del backend, reduciendo el uso de memoria y el riesgo de timeout del proxy Cloudflare.

### Endpoint

```
POST /api/v1/payment-vouchers
```

### Acceso

Privado (Client)

### Encabezados

| Encabezado    | Valor               | Obligatorio |
| ------------- | ------------------- | ----------- |
| Authorization | Bearer {token}      | Sí          |
| Content-Type  | multipart/form-data | Sí          |

### Cuerpo de Solicitud

| Campo         | Tipo   | Descripción                                   |
| ------------- | ------ | --------------------------------------------- |
| evidence      | file   | Imagen del voucher (JPEG, PNG, WebP, max 5MB) |
| loanId        | string | ID del préstamo                               |
| amount        | string | Monto del voucher                             |
| operationId   | string | ID de operación bancaria                      |
| operationDate | string | Fecha de operación (ISO8601)                  |
| observation   | string | Observación                                   |

### Diccionario de Datos

| Campo         | Tipo   | Obligatorio | Descripción        | Restricciones            |
| ------------- | ------ | ----------- | ------------------ | ------------------------ |
| loanId        | uuid   | Sí          | ID del préstamo    | UUID válido              |
| amount        | string | Sí          | Monto              | Número positivo          |
| operationId   | string | Sí          | ID de operación    | Obligatorio              |
| operationDate | date   | No          | Fecha de operación | No puede ser futura      |
| observation   | string | No          | Observación        | -                        |
| evidence      | file   | No          | Imagen del voucher | JPEG, PNG, WebP, max 5MB |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Voucher registrado",
  "data": {
    "id": "uuid",
    "loanId": "uuid",
    "amount": "5000.00",
    "operationId": "ABC123456",
    "status": "pending_investor_review",
    "evidenceUrl": "https://..."
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                        |
| ------ | ---------------------------------- |
| 201    | Voucher registrado                 |
| 400    | Datos inválidos                    |
| 401    | No autorizado                      |
| 403    | No tiene acceso al préstamo        |
| 409    | Operation ID duplicado             |
| 413    | Archivo excede el límite de 5MB    |
| 500    | Error interno                      |

---

## Get Vouchers

Listar vouchers.

### Endpoint

```
GET /api/v1/payment-vouchers
```

### Acceso

Privado (Admin ve todos, Cliente los suyos, Inversionista los de sus préstamos)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo  | Tipo   | Descripción          |
| ------ | ------ | -------------------- |
| status | string | Filtrar por estado   |
| loanId | uuid   | Filtrar por préstamo |
| page   | number | Número de página     |
| limit  | number | Límite por página    |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Vouchers obtenidos",
  "data": [
    {
      "id": "uuid",
      "loanId": "uuid",
      "amount": "5000.00",
      "operationId": "ABC123456",
      "status": "pending_investor_review",
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

| Código | Descripción        |
| ------ | ------------------ |
| 200    | Vouchers obtenidos |
| 401    | No autorizado      |
| 500    | Error interno      |

---

## Check Operation ID

Verificar rápidamente si un operationId ya existe.

### Endpoint

```
GET /api/v1/payment-vouchers/operation-id/exists
```

### Parámetros de Consulta

| Parámetro   | Tipo   | Descripción     |
| ----------- | ------ | --------------- |
| operationId | string | ID de operación |

### Acceso

Privado (Client)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Verificación completada",
  "data": {
    "exists": true
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción             |
| ------ | ----------------------- |
| 200    | Verificación completada |
| 401    | No autorizado           |
| 500    | Error interno           |

---

## Process Voucher

Aprobar o rechazar un voucher. Si se aprueba en revisión final administrativa, se aplica el pago al préstamo con `method = transfer`.

### Endpoint

```
PATCH /api/v1/payment-vouchers/:id/process
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción    |
| --------- | ---- | -------------- |
| id        | uuid | ID del voucher |

### Acceso

Privado (Admin, Investor)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "action": "approve | reject",
  "observation": "string"
}
```

### Diccionario de Datos

| Campo       | Tipo   | Obligatorio | Descripción       |
| ----------- | ------ | ----------- | ----------------- |
| action      | enum   | Sí          | Acción a realizar |
| observation | string | No          | Observación       |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Voucher procesado",
  "data": {
    "id": "uuid",
    "status": "owner_approved"
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción           |
| ------ | --------------------- |
| 200    | Voucher procesado     |
| 400    | Datos inválidos       |
| 401    | No autorizado         |
| 403    | No tiene permisos     |
| 404    | Voucher no encontrado |
| 500    | Error interno         |

---

## Update Voucher

Editar un voucher pendiente antes de aprobación final. Si el voucher ya fue aprobado y generó un pago aplicado, solo admin/owner puede editarlo; el pago vinculado se actualiza y el préstamo se recalcula.

### Endpoint

```
PATCH /api/v1/payment-vouchers/:id
```

### Acceso

Privado (cliente dueño del voucher pendiente, Admin, Owner)

### Cuerpo de Solicitud

```json
{
  "amount": "4500.00",
  "operationId": "ABC123456",
  "operationDate": "2026-01-02T00:00:00.000Z",
  "observation": "Corrección del voucher"
}
```

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Voucher actualizado",
  "data": {
    "id": "uuid",
    "amount": "4500.00",
    "status": "pending_investor_review"
  }
}
```

---

## Delete Voucher

Eliminar lógicamente un voucher. Un cliente puede eliminar su voucher pendiente; admin/owner puede eliminar vouchers aprobados y, si ya generaron pago, ese pago se elimina lógicamente y el préstamo se recalcula. Rechazo y eliminación se mantienen como eventos distintos.

### Endpoint

```
DELETE /api/v1/payment-vouchers/:id
```

### Acceso

Privado (cliente dueño del voucher pendiente, Admin, Owner)

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Voucher eliminado",
  "data": {
    "id": "uuid",
    "status": "deleted",
    "deletedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Estados de Voucher

| Estado                  | Descripción                             |
| ----------------------- | --------------------------------------- |
| draft                   | Borrador                                |
| pending_investor_review | Pendiente de revisión del inversionista |
| pending_admin_review    | Pendiente de revisión administrativa    |
| investor_approved       | Aprobado por inversionista              |
| investor_rejected       | Rechazado por inversionista             |
| owner_approved          | Aprobado por owner/admin                |
| owner_rejected          | Rechazado por owner/admin               |
| deleted                 | Eliminado lógicamente                   |

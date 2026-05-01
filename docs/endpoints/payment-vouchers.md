# Payment Vouchers

## Tabla de Contenidos

1. [Analyze Voucher](#analyze-voucher)
2. [Submit Voucher](#submit-voucher)
3. [Get Vouchers](#get-vouchers)
4. [Check Operation ID](#check-operation-id)
5. [Process Voucher](#process-voucher)

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
| Authorization | Bearer {token}      | Si          |
| Content-Type  | multipart/form-data | Si          |

### Cuerpo de Solicitud

| Campo    | Tipo | Descripcion                                     |
| -------- | ---- | ----------------------------------------------- |
| evidence | file | Imagen del voucher (JPEG, PNG, WebP, max 1.5MB) |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Analisis completado",
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

| Codigo | Descripcion                         |
| ------ | ----------------------------------- |
| 200    | Analisis completado                 |
| 400    | Archivo invalido o analisis fallido |
| 401    | No autorizado                       |
| 413    | Archivo excede el limite de 1.5MB   |
| 500    | Error interno                       |

---

## Submit Voucher

Subir un nuevo comprobante de pago (Voucher) con la imagen y los datos finales confirmados por el cliente.

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
| Authorization | Bearer {token}      | Si          |
| Content-Type  | multipart/form-data | Si          |

### Cuerpo de Solicitud

| Campo         | Tipo   | Descripcion                                   |
| ------------- | ------ | --------------------------------------------- |
| evidence      | file   | Imagen del voucher (JPEG, PNG, WebP, max 5MB) |
| loanId        | string | ID del prestamo                               |
| amount        | string | Monto del voucher                             |
| operationId   | string | ID de operacion bancaria                      |
| operationDate | string | Fecha de operacion (ISO8601)                  |
| observation   | string | Observacion                                   |

### Diccionario de Datos

| Campo         | Tipo   | Obligatorio | Descripcion        | Restricciones            |
| ------------- | ------ | ----------- | ------------------ | ------------------------ |
| loanId        | uuid   | Si          | ID del prestamo    | UUID valido              |
| amount        | string | Si          | Monto              | Numero positivo          |
| operationId   | string | Si          | ID de operacion    | Obligatorio              |
| operationDate | date   | No          | Fecha de operacion | No puede ser futura      |
| observation   | string | No          | Observacion        | -                        |
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

| Codigo | Descripcion                        |
| ------ | ---------------------------------- |
| 201    | Voucher registrado                 |
| 400    | Datos invalidos                    |
| 401    | No autorizado                      |
| 403    | No tiene acceso al prestamo        |
| 409    | Operation ID duplicado             |
| 413    | Archivo excede el limite de 5MB    |
| 500    | Error interno                      |

---

## Get Vouchers

Listar vouchers.

### Endpoint

```
GET /api/v1/payment-vouchers
```

### Acceso

Privado (Admin ve todos, Cliente los suyos, Inversionista los de sus prestamos)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Parametros de Consulta

| Campo  | Tipo   | Descripcion          |
| ------ | ------ | -------------------- |
| status | string | Filtrar por estado   |
| loanId | uuid   | Filtrar por prestamo |
| page   | number | Numero de pagina     |
| limit  | number | Limite por pagina    |

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

| Codigo | Descripcion        |
| ------ | ------------------ |
| 200    | Vouchers obtenidos |
| 401    | No autorizado      |
| 500    | Error interno      |

---

## Check Operation ID

Verificar rapidamente si un operationId ya existe.

### Endpoint

```
GET /api/v1/payment-vouchers/operation-id/exists
```

### Parametros de Consulta

| Parametro   | Tipo   | Descripcion     |
| ----------- | ------ | --------------- |
| operationId | string | ID de operacion |

### Acceso

Privado (Client)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Si          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Verificacion completada",
  "data": {
    "exists": true
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Codigo | Descripcion             |
| ------ | ----------------------- |
| 200    | Verificacion completada |
| 401    | No autorizado           |
| 500    | Error interno           |

---

## Process Voucher

Aprobar o rechazar un voucher. Si se aprobada, se aplica el pago al prestamo.

### Endpoint

```
PATCH /api/v1/payment-vouchers/:id/process
```

### Parametros de Ruta

| Parametro | Tipo | Descripcion    |
| --------- | ---- | -------------- |
| id        | uuid | ID del voucher |

### Acceso

Privado (Admin, Investor)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Si          |
| Content-Type  | application/json | Si          |

### Cuerpo de Solicitud

```json
{
  "action": "approve | reject",
  "observation": "string"
}
```

### Diccionario de Datos

| Campo       | Tipo   | Obligatorio | Descripcion       |
| ----------- | ------ | ----------- | ----------------- |
| action      | enum   | Si          | Accion a realizar |
| observation | string | No          | Observacion       |

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

| Codigo | Descripcion           |
| ------ | --------------------- |
| 200    | Voucher procesado     |
| 400    | Datos invalidos       |
| 401    | No autorizado         |
| 403    | No tiene permisos     |
| 404    | Voucher no encontrado |
| 500    | Error interno         |

### Estados de Voucher

| Estado                  | Descripcion                             |
| ----------------------- | --------------------------------------- |
| draft                   | Borrador                                |
| pending_investor_review | Pendiente de revision del inversionista |
| investor_approved       | Aprobado por inversionista              |
| investor_rejected       | Rechazado por inversionista             |
| owner_approved          | Aprobado por owner/admin                |
| owner_rejected          | Rechazado por owner/admin               |

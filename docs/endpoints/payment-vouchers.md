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

Analizar un comprobante en el backend con OCR (Google Vision API) y devolver la información extraída y sugerencias. No persiste la imagen ni crea el voucher en la base de datos.

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
  "message": "Imagen analizada correctamente",
  "data": {
    "provider": "google-vision",
    "rawText": "BCP\nFECHA: 2026-05-22\nOPERACION: 987654\nMONTO: S/. 1,500.00",
    "extracted": {
      "amount": "1500.00",
      "operationId": "987654",
      "operationDate": "2026-05-22",
      "bank": "BCP"
    },
    "warnings": [],
    "meta": {
      "mimeType": "image/png",
      "pages": 1,
      "averageConfidence": 0.985
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
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

Subir un nuevo comprobante de pago (Voucher) con la imagen y los datos finales confirmados por el cliente. No se aceptan vouchers sobre préstamos eliminados o que no estén en estado `active`.

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
  "message": "Voucher enviado para revisión",
  "data": {
    "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
    "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "clientId": "uuid-client-id",
    "amount": "5000.00",
    "operationId": "ABC123456",
    "operationDate": "2026-05-22T00:00:00.000Z",
    "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
    "status": "pending_investor_review",
    "observation": "Pago de cuota",
    "processedById": null,
    "createdAt": "2026-05-22T04:30:00.000Z",
    "updatedAt": "2026-05-22T04:30:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                     |
| ------ | ------------------------------- |
| 201    | Voucher registrado              |
| 400    | Datos inválidos                 |
| 401    | No autorizado                   |
| 403    | No tiene acceso al préstamo     |
| 409    | Operation ID duplicado          |
| 413    | Archivo excede el límite de 5MB |
| 500    | Error interno                   |

---

## Get Vouchers

Listar vouchers asociados al usuario según su rol.

- **Admin / Owner**: Puede listar todos los vouchers del sistema.
- **Client**: Solo puede ver sus propios vouchers.
- **Investor**: Puede ver los vouchers correspondientes a préstamos donde figure como inversionista.

### Endpoint

```
GET /api/v1/payment-vouchers
```

### Acceso

Privado (Admin, Owner, Client, Investor)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Campo  | Tipo   | Obligatorio | Descripción                                      |
| ------ | ------ | ----------- | ------------------------------------------------ |
| status | string | No          | Filtrar por estado de voucher                    |
| loanId | uuid   | No          | Filtrar por ID del préstamo                      |
| from   | string | No          | Fecha de creación mínima (ISO8601 YYYY-MM-DD...) |
| to     | string | No          | Fecha de creación máxima (ISO8601 YYYY-MM-DD...) |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Vouchers obtenidos",
  "data": [
    {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "clientId": "uuid-client-id",
      "amount": "5000.00",
      "operationId": "ABC123456",
      "operationDate": "2026-05-22T00:00:00.000Z",
      "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
      "status": "pending_investor_review",
      "observation": "Pago de cuota",
      "processedById": null,
      "createdAt": "2026-05-22T04:30:00.000Z",
      "updatedAt": "2026-05-22T04:30:00.000Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
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

Verificar rápidamente si un `operationId` ya existe en la base de datos (después de normalizarlo).

### Endpoint

```
GET /api/v1/payment-vouchers/operation-id/exists
```

### Acceso

Privado (Client)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Parámetros de Consulta

| Parámetro   | Tipo   | Obligatorio | Descripción                  |
| ----------- | ------ | ----------- | ---------------------------- |
| operationId | string | Sí          | ID de operación a comprobar. |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "ID de operación verificado",
  "data": {
    "operationId": "ABC123456",
    "exists": true
  },
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción             |
| ------ | ----------------------- |
| 200    | Verificación completada |
| 400    | Datos inválidos         |
| 401    | No autorizado           |
| 500    | Error interno           |

---

## Process Voucher

Aprobar o rechazar un voucher.

- **Inversionista**: Puede aprobar (`investor_approved`) o rechazar (`investor_rejected`) vouchers que estén en estado `pending_investor_review`.
- **Admin / Owner**:
  - Si el préstamo tiene inversionista activo, solo puede procesar a `owner_approved` o `owner_rejected` si el estado actual es `investor_approved`.
  - Si el préstamo no tiene inversionista, el administrador puede validar el voucher directamente.
- Si se aprueba en revisión final administrativa (`owner_approved`), se aplica automáticamente el pago al préstamo con `method = "transfer"`.

### Endpoint

```
PATCH /api/v1/payment-vouchers/:id/process
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción    |
| --------- | ---- | -------------- |
| id        | uuid | ID del voucher |

### Acceso

Privado (Admin, Owner, Investor)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud

```json
{
  "action": "approve",
  "observation": "Comprobante verificado con saldo en banco"
}
```

### Diccionario de Datos

| Campo       | Tipo   | Obligatorio | Descripción                            | Restricciones           |
| ----------- | ------ | ----------- | -------------------------------------- | ----------------------- |
| action      | string | Sí          | Acción a realizar sobre el comprobante | `"approve" \| "reject"` |
| observation | string | No          | Observación o motivo de rechazo        | -                       |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Voucher actualizado a owner_approved",
  "data": {
    "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
    "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
    "clientId": "uuid-client-id",
    "amount": "5000.00",
    "operationId": "ABC123456",
    "operationDate": "2026-05-22T00:00:00.000Z",
    "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
    "status": "owner_approved",
    "observation": "Comprobante verificado con saldo en banco",
    "processedById": "uuid-admin-id",
    "createdAt": "2026-05-22T04:30:00.000Z",
    "updatedAt": "2026-05-22T04:35:00.000Z",
    "deletedAt": null
  },
  "meta": {
    "timestamp": "2026-05-22T04:35:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                                 |
| ------ | ------------------------------------------- |
| 200    | Voucher procesado                           |
| 400    | Datos inválidos o error de flujo de negocio |
| 401    | No autorizado                               |
| 403    | No tiene permisos                           |
| 404    | Voucher no encontrado                       |
| 500    | Error interno                               |

---

## Update Voucher

Editar un voucher.

- **Client**: Puede editar su propio voucher si aún se encuentra en un estado pendiente (`draft`, `pending_investor_review`, `pending_admin_review`).
- **Admin / Owner**: Puede editar un voucher que ya ha sido aprobado (`owner_approved`). Si se modifica el monto, la fecha o el ID de operación, se actualiza el pago vinculado y se recalcula el préstamo automáticamente.

### Endpoint

```
PATCH /api/v1/payment-vouchers/:id
```

### Acceso

Privado (Client dueño del voucher pendiente, Admin, Owner)

### Encabezados

| Encabezado    | Valor            | Obligatorio |
| ------------- | ---------------- | ----------- |
| Authorization | Bearer {token}   | Sí          |
| Content-Type  | application/json | Sí          |

### Cuerpo de Solicitud (Campos Opcionales)

```json
{
  "amount": "4500.00",
  "operationId": "ABC123456",
  "operationDate": "2026-05-22T00:00:00.000Z",
  "observation": "Monto corregido",
  "evidenceUrl": "https://..."
}
```

### Respuesta Exitosa

#### Caso 1: Voucher pendiente de revisión (sin recálculo)

```json
{
  "success": true,
  "message": "Voucher actualizado correctamente",
  "data": {
    "voucher": {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "clientId": "uuid-client-id",
      "amount": "4500.00",
      "operationId": "ABC123456",
      "operationDate": "2026-05-22T00:00:00.000Z",
      "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
      "status": "pending_investor_review",
      "observation": "Monto corregido",
      "processedById": null,
      "createdAt": "2026-05-22T04:30:00.000Z",
      "updatedAt": "2026-05-22T04:40:00.000Z",
      "deletedAt": null
    },
    "recalculation": null
  },
  "meta": {
    "timestamp": "2026-05-22T04:40:00.000Z"
  }
}
```

#### Caso 2: Voucher aprobado por Admin/Owner (con recálculo)

```json
{
  "success": true,
  "message": "Voucher actualizado correctamente",
  "data": {
    "voucher": {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "clientId": "uuid-client-id",
      "amount": "4500.00",
      "operationId": "ABC123456",
      "operationDate": "2026-05-22T00:00:00.000Z",
      "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
      "status": "owner_approved",
      "observation": "Monto corregido",
      "processedById": "uuid-admin-id",
      "createdAt": "2026-05-22T04:30:00.000Z",
      "updatedAt": "2026-05-22T04:40:00.000Z",
      "deletedAt": null
    },
    "recalculation": {
      "loan": {
        "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "publicCode": "PR-00001",
        "clientId": "uuid-client-id",
        "investorId": "uuid-investor-id",
        "principal": "10000.00",
        "interestRate": "10.00",
        "installmentsCount": 12,
        "frequency": "monthly",
        "status": "active",
        "totalDebt": "11000.00",
        "overpaidAmount": "0.00",
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-22T04:40:00.000Z",
        "deletedAt": null
      },
      "overpaidAmount": "0.00"
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:40:00.000Z"
  }
}
```

---

## Delete Voucher

Eliminar lógicamente un voucher.

- **Client**: Puede eliminar su voucher si está pendiente (`draft`, `pending_investor_review`, `pending_admin_review`).
- **Admin / Owner**: Puede eliminar cualquier voucher. Si el voucher ya fue aprobado (`owner_approved`), el pago asociado se marcará como revertido (`status = "reversed"` y se definirá su `deletedAt`) y el préstamo se recalculará cronológicamente.

### Endpoint

```
DELETE /api/v1/payment-vouchers/:id
```

### Acceso

Privado (Client dueño del voucher pendiente, Admin, Owner)

### Respuesta Exitosa

#### Caso 1: Voucher pendiente de revisión (sin recálculo)

```json
{
  "success": true,
  "message": "Voucher eliminado correctamente",
  "data": {
    "voucher": {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "clientId": "uuid-client-id",
      "amount": "5000.00",
      "operationId": "ABC123456",
      "operationDate": "2026-05-22T00:00:00.000Z",
      "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
      "status": "deleted",
      "observation": "Pago de cuota",
      "processedById": null,
      "createdAt": "2026-05-22T04:30:00.000Z",
      "updatedAt": "2026-05-22T04:45:00.000Z",
      "deletedAt": "2026-05-22T04:45:00.000Z"
    },
    "recalculation": null
  },
  "meta": {
    "timestamp": "2026-05-22T04:45:00.000Z"
  }
}
```

#### Caso 2: Voucher aprobado por Admin/Owner (con recálculo por eliminación de pago asociado)

```json
{
  "success": true,
  "message": "Voucher eliminado correctamente",
  "data": {
    "voucher": {
      "id": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
      "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
      "clientId": "uuid-client-id",
      "amount": "5000.00",
      "operationId": "ABC123456",
      "operationDate": "2026-05-22T00:00:00.000Z",
      "evidenceUrl": "https://supabase.co/storage/v1/object/sign/vouchers/...",
      "status": "deleted",
      "observation": "Pago de cuota",
      "processedById": "uuid-admin-id",
      "createdAt": "2026-05-22T04:30:00.000Z",
      "updatedAt": "2026-05-22T04:45:00.000Z",
      "deletedAt": "2026-05-22T04:45:00.000Z"
    },
    "recalculation": {
      "loan": {
        "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "publicCode": "PR-00001",
        "clientId": "uuid-client-id",
        "investorId": "uuid-investor-id",
        "principal": "10000.00",
        "interestRate": "10.00",
        "installmentsCount": 12,
        "frequency": "monthly",
        "status": "active",
        "totalDebt": "11000.00",
        "overpaidAmount": "0.00",
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-22T04:45:00.000Z",
        "deletedAt": null
      },
      "overpaidAmount": "0.00"
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:45:00.000Z"
  }
}
```

---

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

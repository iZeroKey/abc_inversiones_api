# Reportes

## Tabla de Contenidos

1. [Client Statement](#client-statement)
2. [Investor Portfolio](#investor-portfolio)
3. [Admin Dashboard](#admin-dashboard)

---

## Client Statement

Estado de cuenta de un cliente, incluyendo detalles de sus préstamos, totales acumulados y estado de mora.

- Si no se provee `:clientId` en la ruta, se asume el del usuario autenticado (si es cliente).
- Los clientes solo pueden consultar su propio estado de cuenta. Los administradores pueden consultar el de cualquier cliente.

### Endpoint

```
GET /api/v1/reports/statement
GET /api/v1/reports/statement/:clientId
```

### Parámetros de Ruta

| Parámetro | Tipo | Obligatorio | Descripción                 |
| --------- | ---- | ----------- | --------------------------- |
| clientId  | uuid | No          | ID del cliente a consultar. |

### Acceso

Privado (Client para sí mismo, Admin)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Estado de cuenta obtenido",
  "data": {
    "client": {
      "id": "uuid-client-id",
      "publicCode": "US-00001",
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "juan.perez@example.com",
      "phone": "+51999999999"
    },
    "summary": {
      "totalPrincipal": "10000.00",
      "totalDebt": "11000.00",
      "activeLoans": 1,
      "paidLoans": 0,
      "totalPaid": "500.00",
      "paymentCount": 1,
      "overdueCount": 0,
      "overdueAmount": "0.00"
    },
    "loans": [
      {
        "id": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "publicCode": "PR-00001",
        "clientId": "uuid-client-id",
        "investorId": "uuid-investor-id",
        "principal": "10000.00",
        "interestRate": "10.00",
        "installmentsCount": 12,
        "frequency": "monthly",
        "startDate": "2026-05-01T00:00:00.000Z",
        "status": "active",
        "totalDebt": "11000.00",
        "overpaidAmount": "0.00",
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-22T04:30:00.000Z",
        "deletedAt": null,
        "clientCode": "US-00001",
        "clientName": "Juan Pérez"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                                   |
| ------ | --------------------------------------------- |
| 200    | Estado de cuenta obtenido                     |
| 401    | No autorizado                                 |
| 403    | Permiso denegado (consultando a otro cliente) |
| 404    | Cliente no encontrado                         |
| 500    | Error interno                                 |

---

## Investor Portfolio

Portafolio de inversiones y resumen de activos del inversionista.

- Si no se especifica `:investorId` en la ruta, se asume el del usuario autenticado (si es inversionista).
- Los inversionistas solo pueden ver su propio portafolio. Los administradores pueden ver el de cualquier inversionista.
- Incluye la lista de vouchers pendientes de revisión (`pendingVouchers`) subidos por los clientes asociados a sus préstamos.

### Endpoint

```
GET /api/v1/reports/portfolio
GET /api/v1/reports/portfolio/:investorId
```

### Parámetros de Ruta

| Parámetro  | Tipo | Obligatorio | Descripción                       |
| ---------- | ---- | ----------- | --------------------------------- |
| investorId | uuid | No          | ID del inversionista a consultar. |

### Acceso

Privado (Investor para sí mismo, Admin)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Portafolio de inversiones obtenido",
  "data": {
    "summary": {
      "totalInvested": "50000.00",
      "expectedRevenue": "55000.00",
      "activeLoans": 5,
      "paidLoans": 2,
      "defaultedLoans": 0
    },
    "loans": [
      {
        "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "publicCode": "PR-00001",
        "clientId": "uuid-client-id",
        "clientCode": "US-00001",
        "clientName": "Juan Pérez",
        "principal": "10000.00",
        "totalDebt": "11000.00",
        "status": "active",
        "createdAt": "2026-05-01T00:00:00.000Z"
      }
    ],
    "pendingVouchers": [
      {
        "voucherId": "7fa8e122-fbf3-472e-aa21-0022ff77ab33",
        "loanId": "2bb837fa-f182-4aa8-9283-718293bc9281",
        "loanPublicCode": "PR-00001",
        "amount": "500.00",
        "operationId": "OP-12345",
        "createdAt": "2026-05-22T04:00:00.000Z"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                                         |
| ------ | --------------------------------------------------- |
| 200    | Portafolio de inversiones obtenido                  |
| 401    | No autorizado                                       |
| 403    | Permiso denegado (consultando a otro inversionista) |
| 404    | Inversionista no encontrado                         |
| 500    | Error interno                                       |

---

## Admin Dashboard

Dashboard global de administración con estadísticas consolidadas del negocio (préstamos, mora, comprobantes pendientes y cantidad de usuarios activos).

### Endpoint

```
GET /api/v1/reports/dashboard
```

### Acceso

Privado (Admin)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Dashboard administrativo",
  "data": {
    "loans": {
      "totalLoans": 20,
      "activeLoans": 15,
      "pendingLoans": 3,
      "totalPortfolio": "150000.00",
      "totalDebt": "165000.00"
    },
    "overdue": {
      "overdueCount": 2,
      "overdueAmount": "1200.00"
    },
    "vouchers": {
      "pendingInvestor": 3,
      "pendingAdmin": 2
    },
    "users": {
      "totalUsers": 50,
      "clients": 35,
      "investors": 10,
      "admins": 5
    }
  },
  "meta": {
    "timestamp": "2026-05-22T04:30:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción        |
| ------ | ------------------ |
| 200    | Dashboard obtenido |
| 401    | No autorizado      |
| 403    | Rol insuficiente   |
| 500    | Error interno      |

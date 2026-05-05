# Reportes

## Tabla de Contenidos

1. [Client Statement](#client-statement)
2. [Investor Portfolio](#investor-portfolio)
3. [Admin Dashboard](#admin-dashboard)

---

## Client Statement

Estado de cuenta de un cliente.

### Endpoint

```
GET /api/v1/reports/statement
GET /api/v1/reports/statement/:clientId
```

### Parámetros de Ruta

| Parámetro | Tipo | Descripción               |
| --------- | ---- | ------------------------- |
| clientId  | uuid | ID del cliente (opcional) |

### Acceso

Privado (Client para sí mismo, Admin para cualquiera)

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
      "id": "uuid",
      "firstName": "Juan",
      "lastName": "Pérez"
    },
    "loans": [
      {
        "id": "uuid",
        "principal": "10000.00",
        "totalDebt": "15000.00",
        "totalPaid": "5000.00",
        "status": "active"
      }
    ],
    "summary": {
      "totalPrincipal": "10000.00",
      "totalDebt": "15000.00",
      "totalPaid": "5000.00",
      "nextPayment": {
        "dueDate": "2024-02-01T00:00:00.000Z",
        "amount": "5000.00"
      }
    }
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción               |
| ------ | ------------------------- |
| 200    | Estado de cuenta obtenido |
| 401    | No autorizado             |
| 404    | Cliente no encontrado     |
| 500    | Error interno             |

---

## Investor Portfolio

Portafolio de inversiones.

### Endpoint

```
GET /api/v1/reports/portfolio
GET /api/v1/reports/portfolio/:investorId
```

### Parámetros de Ruta

| Parámetro  | Tipo | Descripción                     |
| ---------- | ---- | ------------------------------- |
| investorId | uuid | ID del inversionista (opcional) |

### Acceso

Privado (Investor para sí mismo, Admin para cualquiera)

### Encabezados

| Encabezado    | Valor          | Obligatorio |
| ------------- | -------------- | ----------- |
| Authorization | Bearer {token} | Sí          |

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Portafolio obtenido",
  "data": {
    "investor": {
      "id": "uuid",
      "firstName": "Juan",
      "lastName": "Pérez"
    },
    "investments": [
      {
        "loanId": "uuid",
        "client": "Juan Pérez",
        "principal": "10000.00",
        "interestRate": "5.00",
        "totalReturn": "15000.00",
        "status": "active"
      }
    ],
    "summary": {
      "totalInvested": "50000.00",
      "totalReturn": "75000.00",
      "activeLoans": 5,
      "completedLoans": 3
    }
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción                 |
| ------ | --------------------------- |
| 200    | Portafolio obtenido         |
| 401    | No autorizado               |
| 404    | Inversionista no encontrado |
| 500    | Error interno               |

---

## Admin Dashboard

Dashboard global de administración con estadísticas.

### Endpoint

```
GET /api/v1/reports/dashboard
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
  "message": "Dashboard obtenido",
  "data": {
    "users": {
      "total": 50,
      "clients": 30,
      "investors": 15,
      "admins": 5
    },
    "loans": {
      "total": 20,
      "active": 15,
      "pending": 3,
      "paid": 10,
      "defaulted": 2
    },
    "payments": {
      "total": 50,
      "thisMonth": "25000.00"
    },
    "vouchers": {
      "pendingReview": 5,
      "approved": 20,
      "rejected": 3
    }
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción        |
| ------ | ------------------ |
| 200    | Dashboard obtenido |
| 401    | No autorizado      |
| 500    | Error interno      |

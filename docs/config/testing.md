# Testing

## Tabla de Contenidos

1. [Enfoque](#enfoque)
2. [Ejecucion](#ejecucion)
3. [Setup](#setup)
4. [Usuarios de Prueba](#usuarios-de-prueba)
5. [Helpers](#helpers)

---

## Enfoque

La suite de tests utiliza integración real contra el entorno de prueba. No mockea la base de datos ni Supabase.

### Caracteristicas

- Resetea el entorno de prueba completo
- recrea el esquema y buckets
- Ejecuta endpoints reales
- Obtiene tokens JWT reales por login

---

## Ejecucion

### Comando Principal

```bash
pnpm test
```

### Comando watch (desarrollo)

```bash
pnpm test:watch
```

---

## Setup

El setup global ejecuta automaticamente:

1. **Reset del entorno**

```bash
pnpm reset:app --confirm
```

2. **Aplicar esquema**

```bash
pnpm exec drizzle-kit push --force
```

3. **Configurar Storage**

```bash
pnpm setup:storage
```

4. **Sembrar datos**

```bash
pnpm db:seed
```

### En package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## Usuarios de Prueba

### Credenciales

| Rol      | Email            | Contrasena  |
| -------- | ---------------- | ----------- |
| Admin    | admin@abc.com    | password123 |
| Client   | client@abc.com   | password123 |
| Investor | investor@abc.com | password123 |

### Roles Disponibles

- **admin**: Acceso total a todos los modulos
- **client**: Puede ver sus prestamos y subir vouchers
- **investor**: Puede ver prestamos asignados y revisar vouchers

---

## Helpers

Los helpers de testing se encuentran en `src/tests/helpers/`.

### Funciones Disponibles

| Funcion              | Descripcion                                   |
| -------------------- | --------------------------------------------- |
| `login`              | Obtiene token JWT real por email y contrasena |
| `createAuthUser`     | Crea usuario en Supabase Auth                 |
| `createDbUser`       | Crea registro en tabla users                  |
| `createLoan`         | Crea prestamo de prueba                       |
| `createInstallments` | Genera cuotas para un prestamo                |
| `createVoucher`      | Crea voucher de prueba                        |
| `createNotification` | Crea notificacion de prueba                   |
| `createAuditLog`     | Crea log de auditoria                         |
| `getBearerHeader`    | Genera header deAuthorization                 |

### Uso Ejemplo

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { login, createLoan } from "./helpers/integration";

describe("Loans API", () => {
  let token: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    token = await login("admin@abc.com", "password123");
    headers = { Authorization: `Bearer ${token}` };
  });

  it("should create loan", async () => {
    const loan = await createLoan({ clientId: "uuid", principal: "10000" });
    expect(loan).toBeDefined();
  });
});
```

---

## Estructura de Tests

```
src/tests/
├── setup.ts
├── modules/
│   ├── access-requests.test.ts
│   ├── audit.test.ts
│   ├── auth.test.ts
│   ├── db.test.ts
│   ├── health.test.ts
│   ├── loans.test.ts
│   ├── notifications.test.ts
│   ├── payment-vouchers.test.ts
│   ├── payments.test.ts
│   ├── reports.test.ts
│   └── users.test.ts
└── helpers/
    └── integration.ts
```

- `setup.ts`: Configuracion global de tests (reset, esquema, storage, seed)
- `modules/*.test.ts`: Tests de integracion para cada modulo
- `helpers/integration.ts`: Funciones helper para facilitar la creacion de datos y autentic

---

## Notas

- Los tests requieren que las variables `SUPABASE_SERVICE_ROLE_KEY_TEST` y `DATABASE_TEST_URL` esten configuradas en `.env`
- El entorno de prueba debe ser independiente del de produccion
- Los datos se resetean antes de cada ejecucion

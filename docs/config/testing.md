# Testing

## Tabla de Contenidos

1. [Enfoque](#enfoque)
2. [Ejecución](#ejecución)
3. [Setup](#setup)
4. [Usuarios de Prueba](#usuarios-de-prueba)
5. [Helpers](#helpers)

---

## Enfoque

La suite de tests utiliza integración real contra el entorno de prueba. No simula la base de datos ni Supabase.

### Características

- Restablece el entorno de prueba completo
- Recrea el esquema y buckets
- Ejecuta endpoints reales
- Obtiene tokens JWT reales por login

---

## Ejecución

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

El setup global se encuentra en `src/tests/setup.ts` y se ejecuta automáticamente antes de correr las pruebas. Este archivo realiza de forma programática la inicialización y el limpiado del entorno mediante los siguientes pasos:

1. **Restablecer base de datos (Reset)**
   Ejecuta el script para eliminar todas las tablas existentes en la base de datos de pruebas:

   ```bash
   pnpm app:reset --confirm
   ```

2. **Inicialización Integral (Setup)**
   Ejecuta el pipeline unificado para volver a construir todo el entorno:
   ```bash
   pnpm app:setup
   ```
   _(Este comando aplica el esquema de Drizzle, habilita RLS, siembra datos base, corrige zonas horarias y configura los buckets de Supabase)._

### En package.json

Los scripts configurados para ejecutar la suite de pruebas son:

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

| Rol      | Email            | Contraseña  |
| -------- | ---------------- | ----------- |
| Admin    | admin@abc.com    | password123 |
| Client   | client@abc.com   | password123 |
| Investor | investor@abc.com | password123 |

### Roles Disponibles

- **admin**: Acceso total a todos los módulos
- **client**: Puede ver sus préstamos y subir vouchers
- **investor**: Puede ver préstamos asignados y revisar vouchers

---

## Helpers

Los helpers de testing se encuentran en `src/tests/helpers/`.

### Funciones Disponibles

| Función              | Descripción                                   |
| -------------------- | --------------------------------------------- |
| `login`              | Obtiene token JWT real por email y contraseña |
| `createAuthUser`     | Crea usuario en Supabase Auth                 |
| `createDbUser`       | Crea registro en tabla users                  |
| `createLoan`         | Crea préstamo de prueba                       |
| `createInstallments` | Genera cuotas para un préstamo                |
| `createVoucher`      | Crea voucher de prueba                        |
| `createNotification` | Crea notificación de prueba                   |
| `createAuditLog`     | Crea log de auditoría                         |
| `getBearerHeader`    | Genera header de Authorization                |

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

- `setup.ts`: Configuración global de tests (reset, esquema, storage, seed)
- `modules/*.test.ts`: Tests de integración para cada módulo
- `helpers/integration.ts`: Funciones helper para facilitar la creación de datos y autenticación

---

## Notas

- Los tests requieren que las variables `SUPABASE_URL_TEST`, `SUPABASE_ANON_KEY_TEST`, `SUPABASE_SERVICE_ROLE_KEY_TEST` y `DATABASE_URL_TEST` estén configuradas en el archivo `.env`.
- El entorno de prueba debe ser completamente independiente del de producción para evitar la pérdida accidental de datos reales.
- Los datos se restablecen de manera destructiva al inicio de cada ejecución de pruebas.

# Ajuste de redondeo de cuotas fijas

## Resumen

Se refactorizó el cálculo financiero de préstamos para que la cuota redondeada visible sea la cuota oficial del cronograma.

La regla final de negocio es:

```txt
La empresa solo maneja préstamos con interés.
La cuota redondeada visible es la cuota oficial.
Todas las cuotas son iguales.
La última cuota no se ajusta.
El total de deuda sale de la suma real de las cuotas generadas.
```

## Archivos modificados

- `src/modules/loans/loans.finance.ts`
- `src/modules/loans/loans.schema.ts`
- `src/tests/modules/loans.finance.test.ts`
- `src/tests/modules/loans.test.ts`

## Regla de negocio sobre intereses

El sistema no maneja préstamos sin interés.

Por regla de negocio, `interestRate` debe ser mayor a `0`. Si se intenta crear o calcular un préstamo con tasa `0` o negativa, el backend debe rechazar la operación.

Esto simplifica la generación del cronograma y evita escenarios de distribución de capital sin interés que no corresponden al funcionamiento real de la empresa.

## Política normal de cuota fija

Para todo préstamo válido:

1. Se valida que `principal > 0`.
2. Se valida que `interestRate > 0`.
3. Se valida que `installmentsCount` sea entero y mayor a `0`.
4. Se calcula la cuota exacta con la fórmula financiera.
5. Se redondea esa cuota a 2 decimales.
6. La cuota redondeada se convierte en la cuota oficial.
7. `totalDebt` se calcula desde la cuota oficial redondeada.
8. `totalInterest` se calcula como `totalDebt - principal`.
9. Todas las cuotas generadas usan el mismo monto.
10. La última cuota no se ajusta.

Ejemplo:

```ts
{
  principal: 10000,
  interestRate: 5,
  installmentsCount: 12,
}
```

Resultado:

```txt
Cuotas 1 a 12: 1128.25
totalDebt: 13539.00
totalInterest: 3539.00
```

La última cuota no vuelve a ser `1128.30`.

## Casos no soportados

Actualmente no se soportan préstamos con `interestRate === 0`.

Tampoco se soportan tasas negativas.

Si en el futuro la empresa decide ofrecer préstamos sin interés, se deberá definir una política específica para distribuir el capital y manejar diferencias de centavos.

## Validaciones contra inconsistencias de redondeo

En préstamos con interés, el sistema no debe cobrar menos que el capital prestado.

Si el total redondeado de las cuotas queda por debajo del capital, el backend debe lanzar error en lugar de ocultar el problema.

No se debe usar `Math.max` para convertir un interés negativo en `0.00`, porque eso podría esconder una inconsistencia financiera.

Mensaje usado:

```txt
Rounded total debt cannot be lower than principal for interest-bearing loans.
```

## Cuota mínima

No se permiten cuotas de `0.00`.

Cada cuota generada debe ser al menos `0.01`. Si los datos ingresados generan una cuota redondeada menor a `0.01`, el backend debe rechazar la operación.

Mensaje usado:

```txt
Installment amount cannot be lower than 0.01.
```

## Manejo de centavos

Se mantienen helpers internos para trabajar con dinero como enteros cuando se calculan totales y cuotas:

```ts
function moneyToCents(value: number): number
function centsToMoney(cents: number): number
function formatCents(cents: number): string
```

Esto permite comparar, sumar y formatear montos como centavos:

```txt
1128.25 -> 112825
10000.00 -> 1000000
```

Así se reducen errores por precisión de `number`, como `9999.999999`, `0.009999`, `-0` o `-0.00`.

## Validaciones

Se mantienen y refuerzan estas validaciones:

- `principal` debe ser mayor a `0`.
- `interestRate` debe ser mayor a `0`.
- `installmentsCount` debe ser entero y mayor a `0`.
- Se rechazan valores no finitos como `NaN` o `Infinity`.
- La cuota oficial redondeada debe ser al menos `0.01`.
- `totalDebt` no puede ser menor que `principal`.
- `roundMoney` evita devolver `-0`.

## Pruebas implementadas

Se actualizaron las pruebas unitarias y de integración para validar:

- Préstamo normal con interés: `10000`, `5%`, `12` cuotas.
- Que todas las cuotas sean `1128.25`.
- Que la última cuota no sea `1128.30`.
- Que tasa `0` sea rechazada.
- Que tasa negativa sea rechazada.
- Que `principal <= 0`, `NaN` o `Infinity` sea rechazado.
- Que `interestRate <= 0`, `NaN` o `Infinity` sea rechazado.
- Que `installmentsCount <= 0`, `NaN`, `Infinity` o no entero sea rechazado.
- Que una cuota redondeada menor a `0.01` sea rechazada.
- Que `totalDebt < principal` sea rechazado.
- Que `totalDebt` sea igual a la suma real de las cuotas generadas.
- Que no se devuelva `-0` ni `-0.00`.
- Que las pruebas de integración de préstamos esperen los nuevos totales calculados desde la cuota oficial.

## Verificación ejecutada

Las siguientes verificaciones finalizaron correctamente:

```bash
pnpm vitest run src/tests/modules/loans.finance.test.ts
pnpm vitest run src/tests/modules/loans.test.ts
pnpm eslint src/modules/loans/loans.finance.ts src/modules/loans/loans.schema.ts src/tests/modules/loans.finance.test.ts
pnpm typecheck
pnpm test
```

Resultado del suite completo:

```txt
Test Files  14 passed (14)
Tests       92 passed (92)
```

import { describe, expect, it } from "vitest";
import { extractVoucherDataFromText } from "../../modules/payment-vouchers/payment-vouchers.ocr.service.js";

describe("Payment Vouchers OCR Parser", () => {
  it("debería extraer correctamente operationId corto en voucher físico", () => {
    const rawText =
      "AGENTE BCP 02) BOTICA SALVADOR FECHA: 06/04/26 HORA: 15:14:49 NO.OPE: 059207 67121 ---DEPOSITO-- A CTA. AHORROS S/ H995036 NRO: **********1056 S/ 500.00 NOMBRE: GASPAR AL**** MARTHA BE**** MONTO RECIBIDO:";

    const extracted = extractVoucherDataFromText(rawText);

    expect(extracted.amount).toBe("500.00");
    expect(extracted.operationId).toBe("059207");
    expect(extracted.operationDate).toBe("2026-04-06");
    expect(extracted.bank).toBe("BCP");
  });

  it("debería extraer número de operación y fecha textual en voucher digital", () => {
    const rawText =
      ">BCP> ¡Transferencia exitosa! S/1,000.00 Viernes, 03 Abril 2026 - 10:26 a.m. Enviado a Desde Número de operación Flores Ricra Erick O. **** 7020 Moneda Soles Cuenta Personal **** 1094 01045519";

    const extracted = extractVoucherDataFromText(rawText);

    expect(extracted.amount).toBe("1000.00");
    expect(extracted.operationId).toBe("01045519");
    expect(extracted.operationDate).toBe("2026-04-03");
    expect(extracted.bank).toBe("BCP");
  });
});

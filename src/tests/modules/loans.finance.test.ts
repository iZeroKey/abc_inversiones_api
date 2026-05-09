import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  buildInstallmentDrafts,
  calculateFixedInstallment,
  calculateLoanFinancials,
  roundMoney,
} from "../../modules/loans/loans.finance.js";
import { BUSINESS_TIMEZONE } from "../../modules/loans/loans.schedule.js";

describe("Loan financial calculations", () => {
  const startDate = DateTime.fromISO("2026-05-08T00:00:00", {
    zone: BUSINESS_TIMEZONE,
  });

  function sumInstallments(amounts: string[]): number {
    return roundMoney(
      amounts.reduce((total, amount) => total + Number(amount), 0),
    );
  }

  it("mantiene cuota fija oficial para préstamo normal con interés", () => {
    const financials = calculateLoanFinancials({
      principal: 10000,
      interestRate: 5,
      installmentsCount: 12,
    });

    expect(financials.installmentAmount).toBeCloseTo(1128.2541, 4);
    expect(financials.roundedInstallmentAmount).toBe(1128.25);
    expect(financials.totalDebt).toBe(13539);
    expect(financials.totalInterest).toBe(3539);

    const schedule = buildInstallmentDrafts({
      loanId: "00000000-0000-0000-0000-000000000000",
      principal: 10000,
      interestRate: 5,
      installmentsCount: 12,
      frequency: "monthly",
      startDate,
    });
    const amounts = schedule.installments.map((item) => item.amount);

    expect(amounts.every((amount) => amount === "1128.25")).toBe(true);
    expect(amounts.at(-1)).not.toBe("1128.30");
    expect(sumInstallments(amounts)).toBe(schedule.totalDebt);
    expect(schedule.totalDebt).toBe(13539);
  });

  it("rechaza tasa cero", () => {
    expect(() =>
      calculateFixedInstallment({
        principal: 10000,
        interestRate: 0,
        installmentsCount: 12,
      }),
    ).toThrow("interestRate must be greater than zero.");
  });

  it("rechaza tasa negativa", () => {
    expect(() =>
      calculateFixedInstallment({
        principal: 10000,
        interestRate: -5,
        installmentsCount: 12,
      }),
    ).toThrow("interestRate must be greater than zero.");
  });

  it("rechaza número de cuotas inválido", () => {
    for (const installmentsCount of [0, -1, 1.5, Number.NaN, Infinity]) {
      expect(() =>
        calculateFixedInstallment({
          principal: 10000,
          interestRate: 5,
          installmentsCount,
        }),
      ).toThrow("installmentsCount must be greater than zero");
    }
  });

  it("rechaza principal inválido", () => {
    for (const principal of [0, -1, Number.NaN, Infinity]) {
      expect(() =>
        calculateFixedInstallment({
          principal,
          interestRate: 5,
          installmentsCount: 12,
        }),
      ).toThrow("principal must be greater than zero");
    }
  });

  it("rechaza interés inválido", () => {
    for (const interestRate of [0, -1, Number.NaN, Infinity]) {
      expect(() =>
        calculateFixedInstallment({
          principal: 10000,
          interestRate,
          installmentsCount: 12,
        }),
      ).toThrow("interestRate must be greater than zero.");
    }
  });

  it("rechaza cuotas redondeadas menores a 0.01", () => {
    expect(() =>
      calculateLoanFinancials({
        principal: 0.01,
        interestRate: 0.0001,
        installmentsCount: 100,
      }),
    ).toThrow("Installment amount cannot be lower than 0.01.");
  });

  it("rechaza deuda total redondeada menor que el capital", () => {
    expect(() =>
      calculateLoanFinancials({
        principal: 100,
        interestRate: 0.000001,
        installmentsCount: 9999,
      }),
    ).toThrow(
      "Rounded total debt cannot be lower than principal for interest-bearing loans.",
    );
  });

  it("valida que la deuda total sea la suma real del cronograma", () => {
    const schedule = buildInstallmentDrafts({
      loanId: "00000000-0000-0000-0000-000000000000",
      principal: 2500,
      interestRate: 3,
      installmentsCount: 8,
      frequency: "monthly",
      startDate,
    });
    const amounts = schedule.installments.map((item) => item.amount);

    expect(sumInstallments(amounts)).toBe(schedule.totalDebt);
  });

  it("evita representar montos financieros como -0", () => {
    const financials = calculateLoanFinancials({
      principal: 10000,
      interestRate: 5,
      installmentsCount: 12,
    });
    const schedule = buildInstallmentDrafts({
      loanId: "00000000-0000-0000-0000-000000000000",
      principal: 10000,
      interestRate: 5,
      installmentsCount: 12,
      frequency: "monthly",
      startDate,
    });

    expect(roundMoney(-0.001)).toBe(0);
    expect(Object.is(roundMoney(-0.001), -0)).toBe(false);
    expect(Object.is(financials.totalDebt, -0)).toBe(false);
    expect(Object.is(financials.totalInterest, -0)).toBe(false);
    expect(schedule.installments.some((item) => item.amount === "-0.00"))
      .toBe(false);
  });
});

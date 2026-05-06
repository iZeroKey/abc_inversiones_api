import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  buildInstallmentDrafts,
  calculateLoanFinancials,
} from "../../modules/loans/loans.finance.js";
import { BUSINESS_TIMEZONE } from "../../modules/loans/loans.schedule.js";

describe("Loan financial calculations", () => {
  it("calcula cuota fija sin variar por frecuencia", () => {
    const financials = calculateLoanFinancials({
      principal: 10000,
      interestRate: 5,
      installmentsCount: 12,
    });

    expect(financials.roundedInstallmentAmount).toBe(1128.25);
    expect(financials.totalDebt).toBe(13539.05);
    expect(financials.totalInterest).toBe(3539.05);
  });

  it("ajusta la última cuota para que el cronograma sume la deuda total", () => {
    const startDate = DateTime.fromISO("2026-05-08T00:00:00", {
      zone: BUSINESS_TIMEZONE,
    });
    const schedule = buildInstallmentDrafts({
      loanId: "00000000-0000-0000-0000-000000000000",
      principal: 10000,
      interestRate: 5,
      installmentsCount: 12,
      frequency: "monthly",
      startDate,
    });

    expect(schedule.installments.at(0)?.amount).toBe("1128.25");
    expect(schedule.installments.at(-1)?.amount).toBe("1128.30");
    expect(
      schedule.installments.reduce(
        (total, installment) => total + Number(installment.amount),
        0,
      ),
    ).toBe(13539.05);
  });
});

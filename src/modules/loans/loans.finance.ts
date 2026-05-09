import { DateTime } from "luxon";
import { calculateDueDate, type LoanFrequency } from "./loans.schedule.js";

export type InstallmentDraft = {
  loanId: string;
  installmentNumber: number;
  dueDate: Date;
  amount: string;
  paidAmount: string;
  status: "pending";
};

export function roundMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function moneyToCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("money value must be finite");
  }

  const cents = Math.round((value + Number.EPSILON) * 100);
  return Object.is(cents, -0) ? 0 : cents;
}

function centsToMoney(cents: number): number {
  return roundMoney(cents / 100);
}

function formatCents(cents: number): string {
  return centsToMoney(cents).toFixed(2);
}

export function calculateFixedInstallment(params: {
  principal: number;
  interestRate: number;
  installmentsCount: number;
}): number {
  const { principal, interestRate, installmentsCount } = params;
  const rate = interestRate / 100;

  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error("principal must be greater than zero");
  }

  if (!Number.isFinite(interestRate) || interestRate <= 0) {
    throw new Error("interestRate must be greater than zero.");
  }

  if (
    !Number.isFinite(installmentsCount) ||
    !Number.isInteger(installmentsCount) ||
    installmentsCount <= 0
  ) {
    throw new Error("installmentsCount must be greater than zero");
  }

  return (principal * rate) / (1 - Math.pow(1 + rate, -installmentsCount));
}

export function calculateLoanFinancials(params: {
  principal: number;
  interestRate: number;
  installmentsCount: number;
}): {
  installmentAmount: number;
  roundedInstallmentAmount: number;
  totalDebt: number;
  totalInterest: number;
} {
  const installmentAmount = calculateFixedInstallment(params);
  const principalCents = moneyToCents(params.principal);
  const roundedInstallmentCents = moneyToCents(installmentAmount);

  if (roundedInstallmentCents < 1) {
    throw new Error("Installment amount cannot be lower than 0.01.");
  }

  const roundedInstallmentAmount = centsToMoney(roundedInstallmentCents);
  const totalDebtCents = roundedInstallmentCents * params.installmentsCount;

  if (totalDebtCents < principalCents) {
    throw new Error(
      "Rounded total debt cannot be lower than principal for interest-bearing loans.",
    );
  }

  const totalInterestCents = totalDebtCents - principalCents;

  return {
    installmentAmount,
    roundedInstallmentAmount,
    totalDebt: centsToMoney(totalDebtCents),
    totalInterest: centsToMoney(totalInterestCents),
  };
}

export function buildInstallmentDrafts(params: {
  loanId: string;
  principal: number;
  interestRate: number;
  installmentsCount: number;
  frequency: LoanFrequency;
  startDate: DateTime;
}): {
  installments: InstallmentDraft[];
  installmentAmount: number;
  totalDebt: number;
} {
  const financials = calculateLoanFinancials(params);
  const installments: InstallmentDraft[] = [];
  const roundedInstallmentCents = moneyToCents(
    financials.roundedInstallmentAmount,
  );

  for (let i = 1; i <= params.installmentsCount; i++) {
    const dueDate = calculateDueDate(params.startDate, i, params.frequency);
    const amountCents = roundedInstallmentCents;

    installments.push({
      loanId: params.loanId,
      installmentNumber: i,
      dueDate: dueDate.toJSDate(),
      amount: formatCents(amountCents),
      paidAmount: "0.00",
      status: "pending",
    });
  }

  return {
    installments,
    installmentAmount: financials.roundedInstallmentAmount,
    totalDebt: financials.totalDebt,
  };
}

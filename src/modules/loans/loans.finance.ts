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
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateFixedInstallment(params: {
  principal: number;
  interestRate: number;
  installmentsCount: number;
}): number {
  const { principal, interestRate, installmentsCount } = params;
  const rate = interestRate / 100;

  if (installmentsCount <= 0) {
    throw new Error("installmentsCount must be greater than zero");
  }

  if (rate === 0) {
    return principal / installmentsCount;
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
  const totalDebt = roundMoney(installmentAmount * params.installmentsCount);

  return {
    installmentAmount,
    roundedInstallmentAmount: roundMoney(installmentAmount),
    totalDebt,
    totalInterest: roundMoney(totalDebt - params.principal),
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
  let accumulatedAmount = 0;

  for (let i = 1; i <= params.installmentsCount; i++) {
    const dueDate = calculateDueDate(params.startDate, i, params.frequency);
    const isLastInstallment = i === params.installmentsCount;
    const amount = isLastInstallment
      ? roundMoney(financials.totalDebt - accumulatedAmount)
      : financials.roundedInstallmentAmount;

    accumulatedAmount = roundMoney(accumulatedAmount + amount);

    installments.push({
      loanId: params.loanId,
      installmentNumber: i,
      dueDate: dueDate.toJSDate(),
      amount: amount.toFixed(2),
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

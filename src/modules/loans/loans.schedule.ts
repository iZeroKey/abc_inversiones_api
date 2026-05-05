import { DateTime } from "luxon";

export const BUSINESS_TIMEZONE = "America/Lima";

export type LoanFrequency = "monthly" | "biweekly" | "weekly" | "daily";

function ensureValidDateTime(date: DateTime, context: string): DateTime {
  if (!date.isValid) {
    throw new Error(`${context}: ${date.invalidExplanation || "invalid date"}`);
  }

  return date;
}

export function normalizeScheduleStartDate(date: Date): DateTime {
  return ensureValidDateTime(
    DateTime.fromJSDate(date, { zone: BUSINESS_TIMEZONE }).startOf("day"),
    "Invalid loan start date",
  );
}

export function calculateMonthlyDueDate(
  startDate: DateTime,
  installmentNumber: number,
): DateTime {
  const normalizedStartDate = ensureValidDateTime(
    startDate.setZone(BUSINESS_TIMEZONE).startOf("day"),
    "Invalid monthly schedule start date",
  );
  const targetMonth = ensureValidDateTime(
    normalizedStartDate.plus({ months: installmentNumber }),
    "Invalid monthly schedule target month",
  );

  const originalDay = normalizedStartDate.day;
  const maxDayOfTargetMonth = targetMonth.daysInMonth;

  if (!maxDayOfTargetMonth) {
    throw new Error("Unable to calculate days in target month");
  }

  const validDay = Math.min(originalDay, maxDayOfTargetMonth);

  return targetMonth.set({ day: validDay }).startOf("day");
}

export function calculateDueDate(
  startDate: DateTime,
  installmentNumber: number,
  frequency: LoanFrequency,
): DateTime {
  const normalizedStartDate = ensureValidDateTime(
    startDate.setZone(BUSINESS_TIMEZONE).startOf("day"),
    "Invalid schedule start date",
  );

  switch (frequency) {
    case "monthly":
      return calculateMonthlyDueDate(normalizedStartDate, installmentNumber);
    case "biweekly":
      return normalizedStartDate.plus({ days: 15 * installmentNumber });
    case "weekly":
      return normalizedStartDate.plus({ days: 7 * installmentNumber });
    case "daily":
      return normalizedStartDate.plus({ days: installmentNumber });
    default:
      throw new Error(`Unsupported loan frequency: ${frequency}`);
  }
}

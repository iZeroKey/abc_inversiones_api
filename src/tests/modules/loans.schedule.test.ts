import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIMEZONE,
  calculateDueDate,
  normalizeScheduleStartDate,
  type LoanFrequency,
} from "../../modules/loans/loans.schedule.js";

function toISODate(date: DateTime) {
  return date.toISODate();
}

function startDate(isoDate: string) {
  return DateTime.fromISO(`${isoDate}T00:00:00`, { zone: BUSINESS_TIMEZONE });
}

function expectSchedule(
  date: string,
  frequency: LoanFrequency,
  expected: Record<number, string>,
) {
  const start = startDate(date);

  for (const [installmentNumber, expectedDate] of Object.entries(expected)) {
    expect(
      toISODate(calculateDueDate(start, Number(installmentNumber), frequency)),
    ).toBe(expectedDate);
  }
}

describe("Loan schedule date calculations", () => {
  it("calcula mensual desde 31/01/2026 sin arrastrar el ajuste de febrero", () => {
    expectSchedule("2026-01-31", "monthly", {
      1: "2026-02-28",
      2: "2026-03-31",
      3: "2026-04-30",
      4: "2026-05-31",
      10: "2026-11-30",
    });
  });

  it("calcula mensual desde 30/01/2026 respetando el día base", () => {
    expectSchedule("2026-01-30", "monthly", {
      1: "2026-02-28",
      2: "2026-03-30",
      3: "2026-04-30",
      4: "2026-05-30",
    });
  });

  it("calcula mensual desde 29/01/2026", () => {
    expectSchedule("2026-01-29", "monthly", {
      1: "2026-02-28",
      2: "2026-03-29",
      3: "2026-04-29",
    });
  });

  it("calcula mensual desde 30/01/2028 en año bisiesto", () => {
    expectSchedule("2028-01-30", "monthly", {
      1: "2028-02-29",
      2: "2028-03-30",
      3: "2028-04-30",
    });
  });

  it("calcula mensual desde 31/01/2028 en año bisiesto", () => {
    expectSchedule("2028-01-31", "monthly", {
      1: "2028-02-29",
      2: "2028-03-31",
      3: "2028-04-30",
    });
  });

  it("calcula mensual desde 15/01/2026", () => {
    expectSchedule("2026-01-15", "monthly", {
      1: "2026-02-15",
      2: "2026-03-15",
      3: "2026-04-15",
    });
  });

  it("calcula quincenal con 15 días exactos", () => {
    expectSchedule("2026-01-31", "biweekly", {
      1: "2026-02-15",
      2: "2026-03-02",
      3: "2026-03-17",
      4: "2026-04-01",
      5: "2026-04-16",
      10: "2026-06-30",
    });
  });

  it("calcula semanal con 7 días exactos", () => {
    expectSchedule("2026-01-31", "weekly", {
      1: "2026-02-07",
      2: "2026-02-14",
      3: "2026-02-21",
      4: "2026-02-28",
    });
  });

  it("calcula diario con la regla operativa: la primera cuota inicia 2 días después", () => {
    expectSchedule("2026-01-31", "daily", {
      1: "2026-02-02",
      2: "2026-02-03",
      3: "2026-02-04",
    });
  });

  it("calcula las fechas esperadas para inicio 08/05/2026", () => {
    expectSchedule("2026-05-08", "monthly", {
      1: "2026-06-08",
      2: "2026-07-08",
      12: "2027-05-08",
    });

    expectSchedule("2026-05-08", "biweekly", {
      1: "2026-05-23",
      2: "2026-06-07",
      12: "2026-11-04",
    });

    expectSchedule("2026-05-08", "weekly", {
      1: "2026-05-15",
      2: "2026-05-22",
      12: "2026-07-31",
    });

    expectSchedule("2026-05-08", "daily", {
      1: "2026-05-10",
      2: "2026-05-11",
      12: "2026-05-21",
    });
  });

  it("normaliza Date a inicio del día en la zona del negocio", () => {
    const normalized = normalizeScheduleStartDate(
      new Date("2026-01-31T12:35:00.000-05:00"),
    );

    expect(normalized.zoneName).toBe(BUSINESS_TIMEZONE);
    expect(normalized.toISO()).toBe("2026-01-31T00:00:00.000-05:00");
  });
});

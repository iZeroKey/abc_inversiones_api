import "dotenv/config";
import { asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, queryClient } from "../config/db.js";
import { loans } from "../db/schema/loans.js";
import { users } from "../db/schema/users.js";
import {
  generatePublicCode,
  parsePublicCodeNumber,
  setPublicCodeSequenceValue,
  type PublicCodeKind,
} from "../utils/public-code.util.js";

async function getMaxLoanCodeNumber(): Promise<number> {
  const loanRows = await db
    .select({ publicCode: loans.publicCode })
    .from(loans)
    .where(isNotNull(loans.publicCode));

  return Math.max(
    ...loanRows.map((row) => parsePublicCodeNumber(row.publicCode, "loan")),
    0,
  );
}

async function getMaxUserCodeNumber(
  kind: Exclude<PublicCodeKind, "loan">,
): Promise<number> {
  const role = kind;
  const userRows = await db
    .select({ publicCode: users.publicCode })
    .from(users)
    .where(sql`${users.role} = ${role} AND ${users.publicCode} IS NOT NULL`);

  return Math.max(
    ...userRows.map((row) => parsePublicCodeNumber(row.publicCode, kind)),
    0,
  );
}

async function syncSequencesWithExistingCodes() {
  await setPublicCodeSequenceValue("loan", await getMaxLoanCodeNumber());
  await setPublicCodeSequenceValue(
    "client",
    await getMaxUserCodeNumber("client"),
  );
  await setPublicCodeSequenceValue(
    "investor",
    await getMaxUserCodeNumber("investor"),
  );
  await setPublicCodeSequenceValue(
    "admin",
    await getMaxUserCodeNumber("admin"),
  );
}

async function backfillLoans(): Promise<number> {
  const rows = await db
    .select({ id: loans.id })
    .from(loans)
    .where(isNull(loans.publicCode))
    .orderBy(asc(loans.createdAt), asc(loans.id));

  for (const row of rows) {
    await db
      .update(loans)
      .set({ publicCode: await generatePublicCode("loan") })
      .where(eq(loans.id, row.id));
  }

  return rows.length;
}

async function backfillUsers(
  kind: Exclude<PublicCodeKind, "loan">,
): Promise<number> {
  const role = kind;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.role} = ${role} AND ${users.publicCode} IS NULL`)
    .orderBy(asc(users.createdAt), asc(users.id));

  for (const row of rows) {
    await db
      .update(users)
      .set({ publicCode: await generatePublicCode(kind) })
      .where(eq(users.id, row.id));
  }

  return rows.length;
}

async function main() {
  console.log("Asignando códigos públicos faltantes...");

  await syncSequencesWithExistingCodes();

  const loansCount = await backfillLoans();
  const clientsCount = await backfillUsers("client");
  const investorsCount = await backfillUsers("investor");
  const adminsCount = await backfillUsers("admin");

  console.log(`Préstamos actualizados: ${loansCount}`);
  console.log(`Clientes actualizados: ${clientsCount}`);
  console.log(`Inversionistas actualizados: ${investorsCount}`);
  console.log(`Administradores actualizados: ${adminsCount}`);
  console.log("Backfill de códigos públicos completado.");
}

main()
  .catch((error) => {
    console.error("Error en backfill de códigos públicos:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });

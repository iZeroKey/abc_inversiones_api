import { queryClient } from "../config/db.js";

export type PublicCodeKind = "loan" | "client" | "investor" | "admin";
export type PublicCodeRole = "client" | "investor" | "admin";

type PublicCodeSpec = {
  prefix: "PR" | "CL" | "IN" | "AD";
  separator: "-";
  width: number;
  sequenceName: string;
};

const PUBLIC_CODE_MAX = 99999;

export const publicCodeSpecs: Record<PublicCodeKind, PublicCodeSpec> = {
  loan: {
    prefix: "PR",
    separator: "-",
    width: 5,
    sequenceName: "loan_public_code_seq",
  },
  client: {
    prefix: "CL",
    separator: "-",
    width: 5,
    sequenceName: "client_public_code_seq",
  },
  investor: {
    prefix: "IN",
    separator: "-",
    width: 5,
    sequenceName: "investor_public_code_seq",
  },
  admin: {
    prefix: "AD",
    separator: "-",
    width: 5,
    sequenceName: "admin_public_code_seq",
  },
};

export function publicCodeKindForRole(
  role: PublicCodeRole,
): Exclude<PublicCodeKind, "loan"> {
  if (role === "client") return "client";
  if (role === "investor") return "investor";
  return "admin";
}

export function formatPublicCode(
  kind: PublicCodeKind,
  value: number,
): string {
  if (!Number.isInteger(value) || value < 1 || value > PUBLIC_CODE_MAX) {
    throw new Error(`Public code sequence exhausted for ${kind}`);
  }

  const spec = publicCodeSpecs[kind];
  return `${spec.prefix}${spec.separator}${value.toString().padStart(spec.width, "0")}`;
}

export function parsePublicCodeNumber(
  code: string | null | undefined,
  kind?: PublicCodeKind,
): number {
  if (!code) return 0;

  if (kind) {
    const spec = publicCodeSpecs[kind];
    if (!code.startsWith(`${spec.prefix}${spec.separator}`)) {
      return 0;
    }
  }

  const match = /^[A-Z]{2}-(\d{5})$/.exec(code);
  if (!match) {
    return 0;
  }

  return Number(match[1]);
}

export async function generatePublicCode(kind: PublicCodeKind): Promise<string> {
  const spec = publicCodeSpecs[kind];
  const rows = await queryClient.unsafe(
    `SELECT nextval('${spec.sequenceName}') AS value`,
  );
  const value = Number(rows[0]?.value);

  return formatPublicCode(kind, value);
}

export async function setPublicCodeSequenceValue(
  kind: PublicCodeKind,
  value: number,
): Promise<void> {
  const sequenceName = publicCodeSpecs[kind].sequenceName;
  const normalizedValue = Math.max(value, 1);
  const isCalled = value > 0;

  await queryClient.unsafe(
    `SELECT setval('${sequenceName}', ${normalizedValue}, ${isCalled})`,
  );
}

export async function generatePublicCodeForRole(
  role: PublicCodeRole,
): Promise<string> {
  const kind = publicCodeKindForRole(role);
  return generatePublicCode(kind);
}

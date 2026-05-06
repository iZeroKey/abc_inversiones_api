import { pgSequence } from "drizzle-orm/pg-core";

export const loanPublicCodeSeq = pgSequence("loan_public_code_seq", {
  startWith: 1,
  increment: 1,
  maxValue: 99999,
});

export const clientPublicCodeSeq = pgSequence("client_public_code_seq", {
  startWith: 1,
  increment: 1,
  maxValue: 99999,
});

export const investorPublicCodeSeq = pgSequence("investor_public_code_seq", {
  startWith: 1,
  increment: 1,
  maxValue: 99999,
});

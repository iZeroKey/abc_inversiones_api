import { realtimeService } from "../realtime/websocket.service.js";

type LoanDomainPayload = {
  loanId: string;
  clientId?: string | null;
  investorId?: string | null;
  status?: string | null;
  paymentId?: string | null;
  voucherId?: string | null;
};

type AudienceOptions = {
  includeAdmins?: boolean;
  userIds?: Array<string | null | undefined>;
};

export const emitLoanDomainEvent = (
  type: string,
  payload: LoanDomainPayload,
  audience?: AudienceOptions,
): void => {
  realtimeService.emitToAudience(
    {
      includeAdmins: audience?.includeAdmins ?? true,
      userIds: audience?.userIds ?? [payload.clientId, payload.investorId],
    },
    type,
    payload,
  );
};

export const emitUserDomainEvent = (
  type: string,
  payload: { userId: string; role?: string | null; active?: boolean | null },
  audience?: AudienceOptions,
): void => {
  realtimeService.emitToAudience(
    {
      includeAdmins: audience?.includeAdmins ?? true,
      userIds: audience?.userIds ?? [payload.userId],
    },
    type,
    payload,
  );
};

export const emitAccessRequestDomainEvent = (
  type: string,
  payload: { requestId: string; status?: string | null },
): void => {
  realtimeService.emitToAudience(
    {
      includeAdmins: true,
    },
    type,
    payload,
  );
};

export const emitAuditDomainEvent = (payload: {
  auditLogId: string;
  action: string;
  module: string;
  entityId?: string | null;
  userId?: string | null;
}): void => {
  realtimeService.emitToAudience(
    {
      includeAdmins: true,
    },
    "audit.created",
    payload,
  );
};

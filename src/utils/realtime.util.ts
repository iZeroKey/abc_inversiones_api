import { realtimeService } from "../realtime/websocket.service.js";

type LoanDomainPayload = {
  loanId: string;
  clientId?: string | null;
  investorId?: string | null;
  status?: string | null;
  paymentId?: string | null;
  voucherId?: string | null;
};

export const emitLoanDomainEvent = (
  type: string,
  payload: LoanDomainPayload,
): void => {
  realtimeService.emitToAudience(
    {
      includeAdmins: true,
      userIds: [payload.clientId, payload.investorId],
    },
    type,
    payload,
  );
};

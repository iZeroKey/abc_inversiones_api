CREATE INDEX IF NOT EXISTS idx_loans_client_id
ON loans(client_id);

CREATE INDEX IF NOT EXISTS idx_loans_investor_id
ON loans(investor_id);

CREATE INDEX IF NOT EXISTS idx_payments_registered_by
ON payments(registered_by_id);

CREATE INDEX IF NOT EXISTS idx_payments_voucher_id
ON payments(voucher_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_client_id
ON payment_vouchers(client_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_processed_by
ON payment_vouchers(processed_by_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_loans_status_deleted_created
ON loans(status, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_loan_date
ON payments(loan_id, payment_date DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_installments_loan_status
ON installments(loan_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_vouchers_operation_id
ON payment_vouchers(operation_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_active
ON users(role, active)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, is_read, created_at DESC);

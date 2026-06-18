import "dotenv/config";
import { queryClient } from "../config/db.js";

const TABLES = [
  "users",
  "access_requests",
  "loans",
  "installments",
  "payments",
  "payment_vouchers",
  "audit_logs",
  "notifications",
];

const POLICIES = [
  ["users", "admin_all_access"],
  ["users", "user_self_access"],
  ["users", "user_self_update"],
  ["access_requests", "admin_access_requests_all"],
  ["access_requests", "public_insert_access_requests"],
  ["loans", "admin_loans_all"],
  ["loans", "client_loans_select"],
  ["loans", "investor_loans_select"],
  ["installments", "admin_installments_all"],
  ["installments", "client_installments_select"],
  ["installments", "investor_installments_select"],
  ["payments", "admin_payments_all"],
  ["payments", "client_payments_select"],
  ["payments", "investor_payments_select"],
  ["payment_vouchers", "admin_vouchers_all"],
  ["payment_vouchers", "client_vouchers_self"],
  ["payment_vouchers", "client_vouchers_select"],
  ["payment_vouchers", "investor_vouchers_view"],
  ["audit_logs", "admin_audit_logs_all"],
  ["audit_logs", "user_audit_logs_self_select"],
  ["notifications", "admin_notifications_all"],
  ["notifications", "user_notifications_self_select"],
  ["notifications", "user_notifications_self_update"],
];

const adminPredicate = "private.is_admin()";

const currentUserPredicate = (column: string) =>
  `${column} = private.current_app_user_id()`;

const statements = [
  "CREATE SCHEMA IF NOT EXISTS private",
  `CREATE OR REPLACE FUNCTION private.current_app_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id
  FROM public.users
  WHERE auth_user_id = auth.uid()::text
    AND active = true
    AND deleted_at IS NULL
  LIMIT 1
$$`,
  "REVOKE ALL ON FUNCTION private.current_app_user_id() FROM PUBLIC",
  "GRANT EXECUTE ON FUNCTION private.current_app_user_id() TO authenticated",
  `CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = private.current_app_user_id()
      AND active = true
      AND deleted_at IS NULL
      AND (role = 'admin' OR is_owner = true)
  )
$$`,
  "REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC",
  "GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated",
  ...TABLES.map(
    (table) => `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
  ),
  ...POLICIES.map(
    ([table, policy]) => `DROP POLICY IF EXISTS "${policy}" ON public.${table}`,
  ),
  `CREATE POLICY "admin_all_access" ON public.users
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "user_self_access" ON public.users
FOR SELECT TO authenticated
USING (${currentUserPredicate("id")})`,
  `CREATE POLICY "admin_access_requests_all" ON public.access_requests
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "public_insert_access_requests" ON public.access_requests
FOR INSERT TO anon
WITH CHECK (true)`,
  `CREATE POLICY "admin_loans_all" ON public.loans
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "client_loans_select" ON public.loans
FOR SELECT TO authenticated
USING (client_id = private.current_app_user_id())`,
  `CREATE POLICY "investor_loans_select" ON public.loans
FOR SELECT TO authenticated
USING (investor_id = private.current_app_user_id())`,
  `CREATE POLICY "admin_installments_all" ON public.installments
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "client_installments_select" ON public.installments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loans
    WHERE loans.id = installments.loan_id
      AND loans.client_id = private.current_app_user_id()
  )
)`,
  `CREATE POLICY "investor_installments_select" ON public.installments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loans
    WHERE loans.id = installments.loan_id
      AND loans.investor_id = private.current_app_user_id()
  )
)`,
  `CREATE POLICY "admin_payments_all" ON public.payments
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "client_payments_select" ON public.payments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loans
    WHERE loans.id = payments.loan_id
      AND loans.client_id = private.current_app_user_id()
  )
)`,
  `CREATE POLICY "investor_payments_select" ON public.payments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loans
    WHERE loans.id = payments.loan_id
      AND loans.investor_id = private.current_app_user_id()
  )
)`,
  `CREATE POLICY "admin_vouchers_all" ON public.payment_vouchers
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "client_vouchers_select" ON public.payment_vouchers
FOR SELECT TO authenticated
USING (client_id = private.current_app_user_id())`,
  `CREATE POLICY "investor_vouchers_view" ON public.payment_vouchers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loans
    WHERE loans.id = payment_vouchers.loan_id
      AND loans.investor_id = private.current_app_user_id()
  )
)`,
  `CREATE POLICY "admin_audit_logs_all" ON public.audit_logs
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "user_audit_logs_self_select" ON public.audit_logs
FOR SELECT TO authenticated
USING (user_id = private.current_app_user_id())`,
  `CREATE POLICY "admin_notifications_all" ON public.notifications
FOR ALL TO authenticated
USING (${adminPredicate})
WITH CHECK (${adminPredicate})`,
  `CREATE POLICY "user_notifications_self_select" ON public.notifications
FOR SELECT TO authenticated
USING (user_id = private.current_app_user_id())`,
];

export async function setupRls(): Promise<void> {
  console.log("Configurando RLS de tablas de aplicación...");

  for (const statement of statements) {
    await queryClient.unsafe(statement);
  }

  console.log("RLS de tablas de aplicación configurado.");
}

const isDirectExecution =
  process.argv[1]?.endsWith("setup-rls.ts") ||
  process.argv[1]?.endsWith("setup-rls.js");

if (isDirectExecution) {
  setupRls()
    .catch((error) => {
      console.error("Error configurando RLS:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await queryClient.end();
    });
}

CREATE SEQUENCE "public"."admin_public_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 99999 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."client_public_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 99999 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."investor_public_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 99999 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."loan_public_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 99999 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"role_requested" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"additional_data" jsonb DEFAULT '{}'::jsonb,
	"observation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"module" text NOT NULL,
	"entity_id" text,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text,
	"name" text,
	"client_id" uuid NOT NULL,
	"investor_id" uuid,
	"principal" numeric(12, 2) NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"interest_type" text DEFAULT 'simple' NOT NULL,
	"interest_period" text DEFAULT 'monthly' NOT NULL,
	"installments_count" integer NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"payment_day" integer,
	"total_debt" numeric(12, 2) NOT NULL,
	"overpaid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_company_funded" boolean DEFAULT false NOT NULL,
	"start_date" timestamp with time zone,
	"observation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"operation_id" text NOT NULL,
	"operation_date" timestamp with time zone,
	"evidence_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"observation" text,
	"processed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment_vouchers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"installment_id" uuid,
	"voucher_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"reference" text,
	"observation" text,
	"evidence_url" text,
	"registered_by_id" uuid NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text,
	"public_code" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"dni" text,
	"address" text,
	"bank" text,
	"bank_accounts" text[] DEFAULT '{}'::text[] NOT NULL,
	"marital_status" text,
	"avatar_url" text,
	"role" text DEFAULT 'client' NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voucher_id_payment_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."payment_vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registered_by_id_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loans_public_code_unique" ON "loans" USING btree ("public_code");--> statement-breakpoint
CREATE UNIQUE INDEX "ui_operation_id" ON "payment_vouchers" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_unique" ON "users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_code_unique" ON "users" USING btree ("public_code");--> statement-breakpoint
CREATE POLICY "admin_access_requests_all" ON "access_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true)));--> statement-breakpoint
CREATE POLICY "public_insert_access_requests" ON "access_requests" AS PERMISSIVE FOR INSERT TO "anon";--> statement-breakpoint
CREATE POLICY "admin_audit_logs_all" ON "audit_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true)));--> statement-breakpoint
CREATE POLICY "user_audit_logs_self_select" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.id = audit_logs.user_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "admin_installments_all" ON "installments" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true)));--> statement-breakpoint
CREATE POLICY "client_installments_select" ON "installments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.client_id WHERE loans.id = installments.loan_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "investor_installments_select" ON "installments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.investor_id WHERE loans.id = installments.loan_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "admin_loans_all" ON "loans" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true)));--> statement-breakpoint
CREATE POLICY "client_loans_select" ON "loans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.id = loans.client_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "investor_loans_select" ON "loans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.id = loans.investor_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "admin_notifications_all" ON "notifications" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true)));--> statement-breakpoint
CREATE POLICY "user_notifications_self_select" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.id = notifications.user_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "admin_vouchers_all" ON "payment_vouchers" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true)));--> statement-breakpoint
CREATE POLICY "client_vouchers_select" ON "payment_vouchers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.id = payment_vouchers.client_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "investor_vouchers_view" ON "payment_vouchers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.investor_id WHERE loans.id = payment_vouchers.loan_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "admin_payments_all" ON "payments" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid()::text AND (users.role = 'admin' OR users.is_owner = true)));--> statement-breakpoint
CREATE POLICY "client_payments_select" ON "payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.client_id WHERE loans.id = payments.loan_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "investor_payments_select" ON "payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM loans INNER JOIN users ON users.id = loans.investor_id WHERE loans.id = payments.loan_id AND users.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "admin_all_access" ON "users" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (SELECT 1 FROM users AS current_user WHERE current_user.auth_user_id = auth.uid()::text AND (current_user.role = 'admin' OR current_user.is_owner = true)));--> statement-breakpoint
CREATE POLICY "user_self_access" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_user_id = auth.uid()::text);
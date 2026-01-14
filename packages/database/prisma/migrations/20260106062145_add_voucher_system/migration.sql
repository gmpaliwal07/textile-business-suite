-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'staff', 'accountant');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('sale', 'purchase', 'sale_return', 'purchase_return');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('cash', 'bank', 'cheque', 'upi', 'card', 'credit');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('received', 'paid');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'synced', 'conflict', 'failed');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('customer', 'supplier', 'both');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'hi', 'gu');

-- CreateEnum
CREATE TYPE "SubscriptionPlanType" AS ENUM ('trial', 'basic_6month', 'basic_yearly', 'pro_6month', 'pro_yearly', 'enterprise_6month', 'enterprise_yearly');

-- CreateEnum
CREATE TYPE "AddonType" AS ENUM ('whatsapp', 'sms', 'einvoice', 'eway_bill', 'custom_reports', 'extra_storage');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('monthly', 'six_month', 'yearly');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('subscription_purchase', 'subscription_renewal', 'addon_purchase', 'addon_renewal', 'refund');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('sales', 'purchase', 'receipt', 'payment', 'journal', 'contra', 'debit_note', 'credit_note');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('capital_account', 'current_assets', 'current_liabilities', 'fixed_assets', 'investments', 'loans_liability', 'loans_asset', 'sales_accounts', 'purchase_accounts', 'direct_expenses', 'indirect_expenses', 'direct_incomes', 'indirect_incomes');

-- CreateEnum
CREATE TYPE "AffectsType" AS ENUM ('balance_sheet', 'profit_loss');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('party_receivable', 'party_payable', 'cash', 'bank', 'sales', 'sales_return', 'purchase', 'purchase_return', 'expense', 'income', 'gst_input', 'gst_output', 'asset', 'liability', 'capital', 'round_off');

-- CreateTable
CREATE TABLE "ledger_groups" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "group_code" TEXT,
    "group_type" "GroupType" NOT NULL,
    "description" TEXT,
    "parent_group_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "affects" "AffectsType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ledger_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledgers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ledger_name" TEXT NOT NULL,
    "ledger_code" TEXT,
    "ledger_type" "LedgerType" NOT NULL,
    "ledger_group_id" TEXT NOT NULL,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "opening_date" DATE NOT NULL,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "party_id" TEXT,
    "bank_name" TEXT,
    "account_number" TEXT,
    "ifsc_code" TEXT,
    "branch_name" TEXT,
    "tax_type" TEXT,
    "tax_rate" DECIMAL(5,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system_ledger" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "voucher_type" "VoucherType" NOT NULL,
    "voucher_number" TEXT NOT NULL,
    "voucher_date" DATE NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reference_number" TEXT,
    "narration" TEXT NOT NULL,
    "total_debit" DECIMAL(15,2) NOT NULL,
    "total_credit" DECIMAL(15,2) NOT NULL,
    "is_posted" BOOLEAN NOT NULL DEFAULT true,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "edited_by" TEXT,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_entries" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "ledger_name" TEXT NOT NULL,
    "debit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2),
    "cgst_amount" DECIMAL(15,2),
    "sgst_amount" DECIMAL(15,2),
    "igst_amount" DECIMAL(15,2),
    "cess_amount" DECIMAL(15,2),
    "narration" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "financial_year_start" INTEGER NOT NULL DEFAULT 4,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "default_language" "Language" NOT NULL DEFAULT 'en',
    "subscription_plan" TEXT NOT NULL DEFAULT 'trial',
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
    "trial_ends_at" TIMESTAMP(3),
    "subscription_ends_at" TIMESTAMP(3),
    "invoice_prefix" TEXT NOT NULL DEFAULT 'INV',
    "invoice_counter" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "language" "Language" NOT NULL DEFAULT 'en',
    "avatar_url" TEXT,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "party_type" "PartyType" NOT NULL,
    "party_code" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp_number" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit_days" INTEGER NOT NULL DEFAULT 0,
    "ledger_id" TEXT,
    "notes" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'synced',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "primary_image_url" TEXT,
    "image_urls" JSONB NOT NULL DEFAULT '[]',
    "base_price" DECIMAL(15,2) NOT NULL,
    "sale_price" DECIMAL(15,2),
    "purchase_price" DECIMAL(15,2),
    "hsn_code" TEXT NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "cess_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "current_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "min_stock_level" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "fabric_type" TEXT,
    "design_number" TEXT,
    "color" TEXT,
    "size" TEXT,
    "weight" DECIMAL(10,3),
    "barcode" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'synced',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_type" "InvoiceType" NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "party_id" TEXT NOT NULL,
    "party_name" TEXT NOT NULL,
    "party_gstin" TEXT,
    "party_state" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cess_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tcs_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tcs_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_einvoice" BOOLEAN NOT NULL DEFAULT false,
    "irn" VARCHAR(64),
    "ack_number" TEXT,
    "ack_date" TIMESTAMP(3),
    "irn_generated_at" TIMESTAMP(3),
    "qr_code_url" TEXT,
    "eway_bill_number" VARCHAR(12),
    "eway_bill_date" DATE,
    "eway_bill_valid_until" DATE,
    "vehicle_number" TEXT,
    "transporter_id" TEXT,
    "distance" INTEGER,
    "transport_mode" TEXT,
    "transporter_doc_number" TEXT,
    "transporter_doc_date" DATE,
    "place_of_supply" TEXT,
    "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "terms_and_conditions" TEXT,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'synced',
    "pdf_url" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "product_code" TEXT,
    "hsn_code" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(15,2) NOT NULL,
    "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cess_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cess_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "payment_date" DATE NOT NULL,
    "party_id" TEXT NOT NULL,
    "party_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reference_number" TEXT,
    "invoice_id" TEXT,
    "bank_name" TEXT,
    "cheque_number" TEXT,
    "cheque_date" DATE,
    "cheque_status" TEXT,
    "upi_transaction_id" TEXT,
    "card_last_4_digits" VARCHAR(4),
    "notes" TEXT,
    "receipt_url" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'synced',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reference_number" TEXT,
    "stock_before" DECIMAL(15,3) NOT NULL,
    "stock_after" DECIMAL(15,3) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sync_status" "SyncStatus" NOT NULL,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "local_data" JSONB,
    "server_data" JSONB,
    "conflict_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "user_role" "UserRole",
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_terms" TEXT,
    "invoice_footer" TEXT,
    "show_logo_on_invoice" BOOLEAN NOT NULL DEFAULT true,
    "show_signature" BOOLEAN NOT NULL DEFAULT true,
    "signature_url" TEXT,
    "print_size" TEXT NOT NULL DEFAULT 'A4',
    "auto_print" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_template_id" TEXT,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "enable_einvoice" BOOLEAN NOT NULL DEFAULT false,
    "einvoice_username" TEXT,
    "einvoice_password" TEXT,
    "gst_portal_username" TEXT,
    "gst_portal_password" TEXT,
    "low_stock_alert" BOOLEAN NOT NULL DEFAULT true,
    "payment_reminder_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_groups_organization_id_idx" ON "ledger_groups"("organization_id");

-- CreateIndex
CREATE INDEX "ledger_groups_parent_group_id_idx" ON "ledger_groups"("parent_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_groups_organization_id_group_name_key" ON "ledger_groups"("organization_id", "group_name");

-- CreateIndex
CREATE UNIQUE INDEX "ledgers_party_id_key" ON "ledgers"("party_id");

-- CreateIndex
CREATE INDEX "ledgers_organization_id_idx" ON "ledgers"("organization_id");

-- CreateIndex
CREATE INDEX "ledgers_ledger_type_idx" ON "ledgers"("ledger_type");

-- CreateIndex
CREATE INDEX "ledgers_party_id_idx" ON "ledgers"("party_id");

-- CreateIndex
CREATE INDEX "ledgers_ledger_group_id_idx" ON "ledgers"("ledger_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledgers_organization_id_ledger_name_key" ON "ledgers"("organization_id", "ledger_name");

-- CreateIndex
CREATE INDEX "vouchers_organization_id_idx" ON "vouchers"("organization_id");

-- CreateIndex
CREATE INDEX "vouchers_voucher_type_idx" ON "vouchers"("voucher_type");

-- CreateIndex
CREATE INDEX "vouchers_voucher_date_idx" ON "vouchers"("voucher_date");

-- CreateIndex
CREATE INDEX "vouchers_reference_type_reference_id_idx" ON "vouchers"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_organization_id_voucher_type_voucher_number_key" ON "vouchers"("organization_id", "voucher_type", "voucher_number");

-- CreateIndex
CREATE INDEX "voucher_entries_voucher_id_idx" ON "voucher_entries"("voucher_id");

-- CreateIndex
CREATE INDEX "voucher_entries_ledger_id_idx" ON "voucher_entries"("ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_gstin_key" ON "organizations"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "parties_ledger_id_key" ON "parties"("ledger_id");

-- CreateIndex
CREATE INDEX "parties_organization_id_idx" ON "parties"("organization_id");

-- CreateIndex
CREATE INDEX "parties_party_type_idx" ON "parties"("party_type");

-- CreateIndex
CREATE INDEX "parties_party_code_idx" ON "parties"("party_code");

-- CreateIndex
CREATE INDEX "parties_phone_idx" ON "parties"("phone");

-- CreateIndex
CREATE INDEX "parties_gstin_idx" ON "parties"("gstin");

-- CreateIndex
CREATE INDEX "parties_sync_status_idx" ON "parties"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- CreateIndex
CREATE INDEX "products_product_code_idx" ON "products"("product_code");

-- CreateIndex
CREATE INDEX "products_product_name_idx" ON "products"("product_name");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_hsn_code_idx" ON "products"("hsn_code");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_sync_status_idx" ON "products"("sync_status");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX "invoices_invoice_number_idx" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_invoice_date_idx" ON "invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "invoices_party_id_idx" ON "invoices"("party_id");

-- CreateIndex
CREATE INDEX "invoices_invoice_type_idx" ON "invoices"("invoice_type");

-- CreateIndex
CREATE INDEX "invoices_irn_idx" ON "invoices"("irn");

-- CreateIndex
CREATE INDEX "invoices_eway_bill_number_idx" ON "invoices"("eway_bill_number");

-- CreateIndex
CREATE INDEX "invoices_sync_status_idx" ON "invoices"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_invoice_number_invoice_type_key" ON "invoices"("organization_id", "invoice_number", "invoice_type");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_items_product_id_idx" ON "invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "invoice_items_organization_id_idx" ON "invoice_items"("organization_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_idx" ON "payments"("organization_id");

-- CreateIndex
CREATE INDEX "payments_party_id_idx" ON "payments"("party_id");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "payments_payment_type_idx" ON "payments"("payment_type");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_sync_status_idx" ON "payments"("sync_status");

-- CreateIndex
CREATE INDEX "inventory_transactions_organization_id_idx" ON "inventory_transactions"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_product_id_idx" ON "inventory_transactions"("product_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_date_idx" ON "inventory_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_type_idx" ON "inventory_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "sync_log_organization_id_idx" ON "sync_log"("organization_id");

-- CreateIndex
CREATE INDEX "sync_log_sync_status_idx" ON "sync_log"("sync_status");

-- CreateIndex
CREATE INDEX "sync_log_entity_type_entity_id_idx" ON "sync_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sync_log_next_retry_at_idx" ON "sync_log"("next_retry_at");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log"("organization_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_organization_id_key" ON "settings"("organization_id");

-- AddForeignKey
ALTER TABLE "ledger_groups" ADD CONSTRAINT "ledger_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_groups" ADD CONSTRAINT "ledger_groups_parent_group_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "ledger_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_ledger_group_id_fkey" FOREIGN KEY ("ledger_group_id") REFERENCES "ledger_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('rent', 'salary', 'electricity', 'water', 'telephone', 'internet', 'transport', 'courier', 'stationery', 'printing', 'repairs_maintenance', 'insurance', 'legal_professional', 'bank_charges', 'interest', 'advertisement', 'commission', 'brokerage', 'travelling', 'entertainment', 'depreciation', 'misc');

-- CreateEnum
CREATE TYPE "ExpenseFrequency" AS ENUM ('one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('interest_received', 'commission_received', 'discount_received', 'scrap_sale', 'asset_sale', 'rent_received', 'misc_income');

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "cogs_amount" DECIMAL(15,2),
ADD COLUMN     "cost_price" DECIMAL(15,2),
ADD COLUMN     "profit_amount" DECIMAL(15,2),
ADD COLUMN     "profit_margin" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "expense_number" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "expense_category" "ExpenseCategory" NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "ledger_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "paid_from" TEXT,
    "bill_number" TEXT,
    "vendor_name" TEXT,
    "vendor_id" TEXT,
    "voucher_id" TEXT,
    "description" TEXT,
    "attachment_url" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "expense_category" "ExpenseCategory" NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "frequency" "ExpenseFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_due_date" DATE NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "paid_from" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_generate" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "vendor_name" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_valuations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "valuation_date" DATE NOT NULL,
    "period_type" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "average_price" DECIMAL(15,2) NOT NULL,
    "total_value" DECIMAL(15,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'FIFO',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_incomes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "income_number" TEXT NOT NULL,
    "income_date" DATE NOT NULL,
    "income_type" "IncomeType" NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "ledger_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "received_in" TEXT,
    "receipt_mode" "PaymentMode",
    "reference_number" TEXT,
    "party_name" TEXT,
    "voucher_id" TEXT,
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "other_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expenses_voucher_id_key" ON "expenses"("voucher_id");

-- CreateIndex
CREATE INDEX "expenses_organization_id_idx" ON "expenses"("organization_id");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "expenses_expense_category_idx" ON "expenses"("expense_category");

-- CreateIndex
CREATE INDEX "expenses_ledger_id_idx" ON "expenses"("ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_organization_id_expense_number_key" ON "expenses"("organization_id", "expense_number");

-- CreateIndex
CREATE INDEX "recurring_expenses_organization_id_idx" ON "recurring_expenses"("organization_id");

-- CreateIndex
CREATE INDEX "recurring_expenses_next_due_date_idx" ON "recurring_expenses"("next_due_date");

-- CreateIndex
CREATE INDEX "recurring_expenses_is_active_idx" ON "recurring_expenses"("is_active");

-- CreateIndex
CREATE INDEX "stock_valuations_organization_id_idx" ON "stock_valuations"("organization_id");

-- CreateIndex
CREATE INDEX "stock_valuations_valuation_date_idx" ON "stock_valuations"("valuation_date");

-- CreateIndex
CREATE INDEX "stock_valuations_product_id_idx" ON "stock_valuations"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_valuations_organization_id_product_id_valuation_date__key" ON "stock_valuations"("organization_id", "product_id", "valuation_date", "period_type");

-- CreateIndex
CREATE UNIQUE INDEX "other_incomes_voucher_id_key" ON "other_incomes"("voucher_id");

-- CreateIndex
CREATE INDEX "other_incomes_organization_id_idx" ON "other_incomes"("organization_id");

-- CreateIndex
CREATE INDEX "other_incomes_income_date_idx" ON "other_incomes"("income_date");

-- CreateIndex
CREATE INDEX "other_incomes_income_type_idx" ON "other_incomes"("income_type");

-- CreateIndex
CREATE UNIQUE INDEX "other_incomes_organization_id_income_number_key" ON "other_incomes"("organization_id", "income_number");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_valuations" ADD CONSTRAINT "stock_valuations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_valuations" ADD CONSTRAINT "stock_valuations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "books_beginning_date" DATE,
ADD COLUMN     "books_locked_before" DATE,
ADD COLUMN     "business_type" TEXT DEFAULT 'trader',
ADD COLUMN     "current_fy_end" DATE,
ADD COLUMN     "current_fy_start" DATE,
ADD COLUMN     "is_chart_setup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_migration_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_opening_balance_entered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opening_balance_diff" DECIMAL(15,2) NOT NULL DEFAULT 0;

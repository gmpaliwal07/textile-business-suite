-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "delivery_address_line1" TEXT,
ADD COLUMN     "delivery_address_line2" TEXT,
ADD COLUMN     "delivery_city" TEXT,
ADD COLUMN     "delivery_pincode" TEXT,
ADD COLUMN     "delivery_state" TEXT;

-- CreateTable
CREATE TABLE "product_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "lot_number" TEXT,
    "purchase_invoice_id" TEXT,
    "purchase_date" DATE NOT NULL,
    "purchase_price" DECIMAL(15,2) NOT NULL,
    "opening_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "current_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "expiry_date" DATE,
    "godown_location" TEXT,
    "thaan" TEXT,
    "design_number" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_batches_organization_id_idx" ON "product_batches"("organization_id");

-- CreateIndex
CREATE INDEX "product_batches_product_id_idx" ON "product_batches"("product_id");

-- CreateIndex
CREATE INDEX "product_batches_batch_number_idx" ON "product_batches"("batch_number");

-- CreateIndex
CREATE INDEX "product_batches_purchase_date_idx" ON "product_batches"("purchase_date");

-- CreateIndex
CREATE UNIQUE INDEX "product_batches_organization_id_product_id_batch_number_key" ON "product_batches"("organization_id", "product_id", "batch_number");

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

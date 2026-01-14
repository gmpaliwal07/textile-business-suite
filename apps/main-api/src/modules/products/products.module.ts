import { Module } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { LedgersModule } from "../ledgers/ledgers.module";
import { ProductBatchesService } from "./product-batches.service";
import { ProductBatchesController } from "./product-batches.controller";

@Module({
    imports: [LedgersModule],
    controllers: [ProductsController, ProductBatchesController],
    providers: [ProductsService, ProductBatchesService],
    exports: [ProductsService, ProductBatchesService]
})
export class ProductsModule { }
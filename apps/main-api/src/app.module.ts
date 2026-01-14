import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { database } from "@textile/database";


import { AuthModule } from "./modules/auth/auth.module";
import { InvoicesModule } from "./modules/invoices/invoice.module";
import { ProductsModule } from "./modules/products/products.module";
import { UsersModule } from "./modules/users/user.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { PartiesModule } from "./modules/parties/parties.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { SyncModule } from "./modules/sync/sync.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RedisModule } from "./common/redis/redis.module";
// import { AddonsModule } from "./modules/addons/addons.module";
import { StorageModule } from "./common/storage/storage.module";
import { BackupModule } from "./modules/backup/backup.module";
@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: ['.env'],
            isGlobal: true,
            cache: true,
        }),
        RedisModule,
        StorageModule,
        BackupModule,
        database.DatabaseModule,
        AuthModule,
        InvoicesModule,
        ProductsModule,
        UsersModule,
        OrganizationsModule,
        PartiesModule,
        PaymentsModule,
        SyncModule,
        ReportsModule,
        ExpensesModule

        // AddonsModule,

    ],
})

export class AppModule { }
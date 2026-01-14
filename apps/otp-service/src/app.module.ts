import { Module } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { OtpModule } from "./modules/otp/otp.module";
import { EmailModule } from "./modules/email/email.module";
import { SmsModule } from "./modules/sms/sms.module";
import { RedisModule } from "./modules/redis/redis.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        RedisModule,
        OtpModule,
        EmailModule,
        SmsModule,

        ]
})

export class AppModule { }
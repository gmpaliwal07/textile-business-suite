import { Module } from "@nestjs/common";
import { SmsService } from "./sms.services";

@Module({
    providers: [SmsService],
    exports: [SmsService],
})
export class SmsModule { }   
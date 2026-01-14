import { Module } from "@nestjs/common";
import { EmailService } from "./email.services";

@Module({
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule { }
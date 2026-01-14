
import { Injectable } from '@nestjs/common';


@Injectable()
export class InvoiceGeneratorService {

    generateInvoiceNumber(prefix: string, counter: number, date: Date): string {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        // Financial year starts in April (month 4)
        const fyStart = month >= 4 ? year : year - 1;
        const fyEnd = fyStart + 1;

        return `${prefix}/${fyStart}-${fyEnd.toString().slice(-2)}/${String(counter).padStart(4, '0')}`;
    }

    getFinancialYear(date: Date = new Date()): { start: number; end: number } {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        if (month >= 4) {
            return { start: year, end: year + 1 };
        }
        return { start: year - 1, end: year };
    }
}
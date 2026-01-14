import { Injectable } from "@nestjs/common";
import { prisma, VoucherType } from "@textile/database";

@Injectable()
export class VoucherGeneratorService {

    constructor(private prisma: prisma.PrismaService) { }

    private getVoucherPrefix(voucherType: VoucherType): string {
        const prefixes: Record<VoucherType, string> = {
            sales: 'SALES',
            purchase: 'PURCH',
            receipt: 'RCPT',
            payment: 'PMT',
            journal: 'JV',
            contra: 'CONTRA',
            debit_note: 'DN',
            credit_note: 'CN',
        };

        return prefixes[voucherType];
    }


    async generateVoucherNumber(
        organizationId: string,
        voucherType: VoucherType,
        voucherDate: Date,
    ): Promise<string> {
        const year = voucherDate.getFullYear().toString().slice(-2);
        const month = String(voucherDate.getMonth() + 1).padStart(2, '0');


        const prefix = this.getVoucherPrefix(voucherType);

        const lastVoucher = await this.prisma.voucher.findFirst({
            where: {
                organizationId,
                voucherType,
                voucherDate: {
                    gte: new Date(voucherDate.getFullYear(), voucherDate.getMonth(), 1),
                    lt: new Date(voucherDate.getFullYear(), voucherDate.getMonth() + 1, 1),
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                voucherNumber: true,
            },
        });

        let counter = 1;

        if (lastVoucher) {
            const parts = lastVoucher.voucherNumber.split('-');
            const lastNumber = String(parts[parts.length - 1]);
            counter = parseInt(lastNumber, 10) + 1;
        }

        return `${prefix}-${year}-${month}-${String(counter).padStart(4, '0')}`;
    }


     validateDoubleEntry(entries: any[]): {
    isValid: boolean;
    totalDebit: number;
    totalCredit: number;
    difference: number;
  } {
    const totalDebit = entries.reduce(
      (sum, entry) => sum + Number(entry.debitAmount || 0),
      0,
    );
    const totalCredit = entries.reduce(
      (sum, entry) => sum + Number(entry.creditAmount || 0),
      0,
    );

    // Round to 2 decimal places
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    // Allow small rounding differences (up to 0.01)
    const difference = Math.abs(roundedDebit - roundedCredit);
    const isValid = difference < 0.01;

    return {
      isValid,
      totalDebit: roundedDebit,
      totalCredit: roundedCredit,
      difference,
    };
  }

  /**
   * Validate each entry has only debit OR credit (not both, not neither)
   */
  validateEntries(entries: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    entries.forEach((entry, index) => {
      const debit = Number(entry.debitAmount || 0);
      const credit = Number(entry.creditAmount || 0);

      // Check if both are zero
      if (debit === 0 && credit === 0) {
        errors.push(`Entry ${index + 1}: Must have either debit or credit amount`);
      }

      // Check if both are non-zero
      if (debit > 0 && credit > 0) {
        errors.push(`Entry ${index + 1}: Cannot have both debit and credit`);
      }

      // Check if negative amounts
      if (debit < 0 || credit < 0) {
        errors.push(`Entry ${index + 1}: Amounts cannot be negative`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate ledgers exist
   */
  async validateLedgers(
    organizationId: string,
    ledgerIds: string[],
  ): Promise<{ isValid: boolean; missingLedgers: string[] }> {
    const ledgers = await this.prisma.ledger.findMany({
      where: {
        id: { in: ledgerIds },
        organizationId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    const foundIds = ledgers.map((l) => l.id);
    const missingLedgers = ledgerIds.filter((id) => !foundIds.includes(id));

    return {
      isValid: missingLedgers.length === 0,
      missingLedgers,
    };
  }

}
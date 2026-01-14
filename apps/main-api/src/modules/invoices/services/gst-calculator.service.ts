import { Injectable } from "@nestjs/common";
import { GST_RULES, INVOICE_CONFIG } from "../constants/gst-rates";

@Injectable()
export class GstCalculatorService {

    calculateGST(
        taxableAmount: number,
        gstRate: number,
        isInterstate: boolean,
    ): {
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        totalGST: number;
    } {
        const totalGST = this.roundOff((taxableAmount * gstRate) / 100);

        if (isInterstate) {
            return {
                cgstAmount: 0,
                sgstAmount: 0,
                igstAmount: totalGST,
                totalGST,
            };
        } else {
            const halfGST = this.roundOff(totalGST / 2);
            return {
                cgstAmount: halfGST,
                sgstAmount: halfGST,
                igstAmount: 0,
                totalGST: halfGST * 2,
            };
        }
    }


    calculateTCS(amount: number, partyTurnover?: number): { tcsAmount: number; tcsPercentage: number } {


        // If party's turnover in current FY exceeds ₹50L, apply TCS
        if (partyTurnover && partyTurnover > GST_RULES.TCS_THRESHOLD) {
            const tcsRate = GST_RULES.TCS_RATE_WITH_PAN;
            const tcsAmount = this.roundOff((amount * tcsRate) / 100);

            return {
                tcsAmount,
                tcsPercentage: tcsRate,
            };
        }

        return {
            tcsAmount: 0,
            tcsPercentage: 0,
        };
    }


    calculateRoundOff(amount: number): number {
        const rounded = Math.round(amount);
        const roundOff = rounded - amount;

        return Math.round(roundOff * 100) / 100;
    }


    roundOff(amount: number): number {
        return Math.round(amount * 100) / 100;
    }

    isInterstate(orgState: string, partyState: string): boolean {
        if (!partyState) return false;
        return orgState.toLowerCase() !== partyState.toLowerCase();
    }
}
export const GST_RATES = {
    TEXTILE: 5,
    CLOTHING: 12,
    LUXURY: 20,
    EXEMPT: 0
}

export const GST_RULES = {
    TCS_THRESHOLD: 5000000, 
    TCS_RATE: 0.1, 
    TCS_RATE_WITH_PAN: 0.075,
    REVERSE_CHARGE_LIMIT: 5000, 
    INTERSTATE_IGST: true, 
    INTRASTATE_CGST_SGST: true, 
} as const;

export const INVOICE_CONFIG = {
    AUTO_ROUND_OFF: true, 
    DECIMAL_PLACES: 2, 
} as const;
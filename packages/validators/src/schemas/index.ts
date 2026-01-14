import { z } from 'zod';


export const phoneSchema = z
    .string()
    .regex(/^(\+91)?[6-9]\d{9}$/, 'Invalid Indian phone number')
    .transform((val) => val.replace(/\D/g, ''));


export const emailSchema = z.string().email('Invalid email address').toLowerCase();


export const gstinSchema = z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .length(15)
    .optional();

export const panSchema = z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
    .length(10)
    .optional();

export const pincodeSchema = z
    .string()
    .regex(/^[1-9][0-9]{5}$/, 'Invalid pincode')
    .length(6);

export const uuidSchema = z.string().uuid();

export const dateSchema = z.coerce.date();

export const positiveNumberSchema = z.number().positive('Must be a positive number');

export const percentageSchema = z
    .number()
    .min(0, 'Percentage cannot be negative')
    .max(100, 'Percentage cannot exceed 100');

export const gstRateSchema = z.enum(['0', '0.25', '3', '5', '12', '18', '28']).or(z.number());


//enums
export const UserRoleSchema = z.enum(['owner', 'manager', 'staff', 'accountant']);

export const InvoiceTypeSchema = z.enum(['sale', 'purchase', 'sale_return', 'purchase_return']);

export const PaymentModeSchema = z.enum(['cash', 'bank', 'cheque', 'upi', 'card', 'credit']);

export const PaymentTypeSchema = z.enum(['received', 'paid']);

export const PartyTypeSchema = z.enum(['customer', 'supplier', 'both']);

export const LanguageSchema = z.enum(['en', 'hi', 'gu']);

export const SyncStatusSchema = z.enum(['pending', 'synced', 'conflict', 'failed']);

// ============================================
// Authentication Schemas
// ============================================

export const SendOTPSchema = z.object({
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    type: z.enum(['login', 'signup', 'reset_password']),
});

export const VerifyOTPSchema = z.object({
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    otpCode: z.string().length(6, 'OTP must be 6 digits'),
});

export const LoginSchema = z.object({
    phone: phoneSchema,
    otpCode: z.string().length(6),
});

export const RefreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ============================================
// Organization Schemas
// ============================================

export const CreateOrganizationSchema = z.object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters'),
    legalName: z.string().optional(),
    gstin: gstinSchema,
    pan: panSchema,
    addressLine1: z.string().min(5, 'Address is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: pincodeSchema,
    phone: phoneSchema,
    email: emailSchema.optional(),
    website: z.string().url('Invalid website URL').optional(),
});

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

// ============================================
// User Schemas
// ============================================

export const CreateUserSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    phone: phoneSchema,
    email: emailSchema.optional(),
    role: UserRoleSchema,
    language: LanguageSchema.default('en'),
    permissions: z.array(z.string()).default([]),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export const UpdateUserProfileSchema = z.object({
    fullName: z.string().min(2).optional(),
    email: emailSchema.optional(),
    language: LanguageSchema.optional(),
    avatarUrl: z.string().url().optional(),
});

// ============================================
// Party Schemas
// ============================================

export const CreatePartySchema = z.object({
    partyType: PartyTypeSchema,
    businessName: z.string().min(2, 'Business name is required'),
    contactPerson: z.string().optional(),
    phone: phoneSchema,
    email: emailSchema.optional(),
    whatsappNumber: phoneSchema.optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: pincodeSchema.optional(),
    gstin: gstinSchema,
    pan: panSchema,
    openingBalance: z.number().default(0),
    creditLimit: z.number().min(0).default(0),
    creditDays: z.number().int().min(0).default(0),
    notes: z.string().optional(),
    tags: z.array(z.string()).default([]),
});

export const UpdatePartySchema = CreatePartySchema.partial();

export const PartyFiltersSchema = z.object({
    partyType: PartyTypeSchema.optional(),
    search: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    isActive: z.boolean().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

// ============================================
// Product Schemas
// ============================================

export const CreateProductSchema = z.object({
    productCode: z.string().min(1, 'Product code is required'),
    productName: z.string().min(2, 'Product name is required'),
    description: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    primaryImageUrl: z.string().url().optional(),
    imageUrls: z.array(z.string().url()).default([]),
    basePrice: positiveNumberSchema,
    salePrice: positiveNumberSchema.optional(),
    purchasePrice: positiveNumberSchema.optional(),
    hsnCode: z.string().min(4, 'HSN code must be at least 4 digits').max(8),
    gstRate: z.number().min(0).max(28),
    cessRate: z.number().min(0).default(0),
    unit: z.string().min(1, 'Unit is required'),
    currentStock: z.number().min(0).default(0),
    minStockLevel: z.number().min(0).default(0),
    fabricType: z.string().optional(),
    designNumber: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    weight: z.number().positive().optional(),
    barcode: z.string().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const ProductFiltersSchema = z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    isActive: z.boolean().optional(),
    lowStock: z.boolean().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

// ============================================
// Invoice Schemas
// ============================================

export const CreateInvoiceItemSchema = z.object({
    productId: uuidSchema.optional(),
    productName: z.string().min(1, 'Product name is required'),
    productCode: z.string().optional(),
    hsnCode: z.string().min(4, 'HSN code is required'),
    quantity: positiveNumberSchema,
    unit: z.string().min(1, 'Unit is required'),
    rate: positiveNumberSchema,
    discountPercentage: percentageSchema.default(0),
    gstRate: z.number().min(0).max(28),
});

export const CreateInvoiceSchema = z.object({
    invoiceType: InvoiceTypeSchema,
    invoiceDate: dateSchema.default(() => new Date()),
    dueDate: dateSchema.optional(),
    partyId: uuidSchema,
    items: z.array(CreateInvoiceItemSchema).min(1, 'At least one item is required'),
    discountPercentage: percentageSchema.default(0),
    discountAmount: z.number().min(0).default(0),
    tcsPercentage: percentageSchema.default(0),
    placeOfSupply: z.string().optional(),
    reverseCharge: z.boolean().default(false),
    notes: z.string().optional(),
    termsAndConditions: z.string().optional(),
});

export const UpdateInvoiceSchema = z.object({
    invoiceDate: dateSchema.optional(),
    dueDate: dateSchema.optional(),
    items: z.array(CreateInvoiceItemSchema).optional(),
    discountPercentage: percentageSchema.optional(),
    notes: z.string().optional(),
    termsAndConditions: z.string().optional(),
});

export const CancelInvoiceSchema = z.object({
    reason: z.string().min(10, 'Cancellation reason must be at least 10 characters'),
});

export const InvoiceFiltersSchema = z.object({
    invoiceType: InvoiceTypeSchema.optional(),
    partyId: uuidSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    status: z.enum(['paid', 'unpaid', 'partial']).optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().default('invoiceDate'),
    sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

// ============================================
// Payment Schemas
// ============================================

export const CreatePaymentSchema = z.object({
    paymentType: PaymentTypeSchema,
    paymentMode: PaymentModeSchema,
    paymentDate: dateSchema.default(() => new Date()),
    partyId: uuidSchema,
    amount: positiveNumberSchema,
    referenceNumber: z.string().optional(),
    invoiceId: uuidSchema.optional(),
    bankName: z.string().optional(),
    chequeNumber: z.string().optional(),
    chequeDate: dateSchema.optional(),
    upiTransactionId: z.string().optional(),
    cardLast4Digits: z.string().length(4).optional(),
    notes: z.string().optional(),
});

export const UpdatePaymentSchema = CreatePaymentSchema.partial();

export const PaymentFiltersSchema = z.object({
    paymentType: PaymentTypeSchema.optional(),
    paymentMode: PaymentModeSchema.optional(),
    partyId: uuidSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().default('paymentDate'),
    sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

// ============================================
// E-Way Bill Schema
// ============================================

export const GenerateEWayBillSchema = z.object({
    invoiceId: uuidSchema,
    vehicleNumber: z
        .string()
        .regex(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/, 'Invalid vehicle number format'),
    transporterId: z.string().optional(),
    distance: z.number().int().positive('Distance must be positive'),
    transMode: z.enum(['Road', 'Rail', 'Air', 'Ship']).default('Road'),
});

// ============================================
// Report Schemas
// ============================================

export const SalesReportSchema = z.object({
    startDate: dateSchema,
    endDate: dateSchema,
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
    partyId: uuidSchema.optional(),
    productId: uuidSchema.optional(),
});

export const OutstandingReportSchema = z.object({
    asOfDate: dateSchema.default(() => new Date()),
    partyType: PartyTypeSchema.optional(),
    minAmount: z.number().optional(),
    overdueOnly: z.boolean().default(false),
});

export const GSTReportSchema = z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000),
    reportType: z.enum(['GSTR1', 'GSTR3B']),
});

export const InventoryReportSchema = z.object({
    category: z.string().optional(),
    lowStockOnly: z.boolean().default(false),
    includeInactive: z.boolean().default(false),
});

// ============================================
// Sync Schemas
// ============================================

export const SyncRequestSchema = z.object({
    entityType: z.enum(['invoice', 'payment', 'party', 'product']),
    action: z.enum(['create', 'update', 'delete']),
    localId: z.string(),
    data: z.any(),
    timestamp: dateSchema,
});

export const BatchSyncSchema = z.object({
    requests: z.array(SyncRequestSchema).min(1).max(100),
});

// ============================================
// Settings Schemas
// ============================================

export const UpdateSettingsSchema = z.object({
    invoiceTerms: z.string().optional(),
    invoiceFooter: z.string().optional(),
    showLogoOnInvoice: z.boolean().optional(),
    showSignature: z.boolean().optional(),
    signatureUrl: z.string().url().optional(),
    printSize: z.enum(['A4', '3inch', '4inch']).optional(),
    autoPrint: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    enableEinvoice: z.boolean().optional(),
    lowStockAlert: z.boolean().optional(),
    paymentReminderDays: z.number().int().min(0).optional(),
});

// ============================================
// File Upload Schemas
// ============================================

export const FileUploadSchema = z.object({
    filename: z.string().min(1, 'Filename is required'),
    mimetype: z.string().min(1, 'MIME type is required'),
    size: z.number().max(5 * 1024 * 1024, 'File size cannot exceed 5MB'),
});

// ============================================
// Pagination Schema
// ============================================

export const PaginationSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

// ============================================
// Type Exports
// ============================================

export type SendOTPDto = z.infer<typeof SendOTPSchema>;
export type VerifyOTPDto = z.infer<typeof VerifyOTPSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>;
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type CreatePartyDto = z.infer<typeof CreatePartySchema>;
export type UpdatePartyDto = z.infer<typeof UpdatePartySchema>;
export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof UpdateInvoiceSchema>;
export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentDto = z.infer<typeof UpdatePaymentSchema>;
export type GenerateEWayBillDto = z.infer<typeof GenerateEWayBillSchema>;
export type SalesReportDto = z.infer<typeof SalesReportSchema>;
export type OutstandingReportDto = z.infer<typeof OutstandingReportSchema>;
export type GSTReportDto = z.infer<typeof GSTReportSchema>;
export type SyncRequestDto = z.infer<typeof SyncRequestSchema>;
export type BatchSyncDto = z.infer<typeof BatchSyncSchema>;
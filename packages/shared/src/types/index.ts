export enum UserType {
    OWNER = 'owner',
    MANAGER = 'manager',
    STAFF = 'staff',
    ACCOUNTANT = 'accountant'
}

export enum InvoiceType {
    SALES = 'sale',
    PURCHASE = 'purchase',
    SALE_RETURN = 'sale_return',
    PURCHASE_RETURN = 'purchase_return'
}
export enum ReturnReason {
    DAMAGED = 'damaged',
    WRONG_ITEM = 'wrong_item',
    QUALITY_ISSUE = 'quality_issue',
    CUSTOMER_REJECTED = 'customer_rejected',
    RATE_DIFFERENCE = 'rate_difference',
    SHORTAGE = 'shortage',
    OTHER = 'other',
}

export enum PaymentMode {
    CASH = 'cash',
    CHEQUE = 'cheque',
    DEBIT = 'debit',
    CREDIT = 'credit',
    UPI = 'upi',
    BANK = 'bank',
}

export enum PaymentType {
    RECEIVED = 'received',
    PAID = 'paid',
}
export enum SyncStatus {
    PENDING = 'pending',
    SYNCED = 'synced',
    CONFLICT = 'conflict',
    FAILED = 'failed',
}
export enum GSTType {
    CGST_SGST = 'cgst_sgst',
    IGST = 'igst',
    EXEMPT = 'exempt',
    NIL_RATED = 'nil_rated',
}
export enum PartyType {
    CUSTOMER = 'customer',
    SUPPLIER = 'supplier',
    BOTH = 'both',
}

export enum SubscriptionStatus {
    TRIAL = 'trial',
    ACTIVE = 'active',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}
export enum Language {
    ENGLISH = 'en',
    HINDI = 'hi',
    GUJARATI = 'gu',
}

export interface IOrg {
    id: string;
    businessName: string;
    legalName?: string;
    gstin?: string;
    pan?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    phone: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    financialYearStart: number;
    currency: string;
    timezone: string;
    defaultLanguage: Language;
    subscriptionPlan: string;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt?: Date;
    subscriptionEndsAt?: Date;
    invoicePrefix: string;
    invoiceCounter: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}


export interface IUser {
    id: string;
    orgId: string;
    fullName: string;
    email?: string;
    phone: string;
    passwordHash?: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    role: UserType;
    permissions: string[];
    language: Language;
    avatarUrl?: string;
    lastLoginAt?: Date;
    lastLoginIp?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface IParty {
    id: string;
    orgId: string;
    partyType: PartyType;
    partyCode: string;
    businessName: string;
    contactPerson?: string;
    phone: string;
    email?: string;
    whatsappNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    pan?: string;
    openingBalance: number;
    currentBalance: number;
    creditLimit: number;
    creditDays: number;
    notes?: string;
    tags: string[];
    isActive: boolean;
    syncStatus: SyncStatus;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface IProduct {
    id: string;
    orgId: string;
    productCode: string;
    productName: string;
    description?: string;
    category?: string;
    subcategory?: string;
    primaryImageUrl?: string;
    imageUrls: string[];
    basePrice: number;
    salePrice?: number;
    purchasePrice?: number;
    hsnCode: string;
    gstRate: number;
    cessRate: number;
    unit: string;
    currentStock: number;
    minStockLevel: number;
    fabricType?: string;
    designNumber?: string;
    color?: string;
    size?: string;
    weight?: number;
    barcode?: string;
    isActive: boolean;
    syncStatus: SyncStatus;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface IInvoice {
    id: string;
    orgId: string;
    invoiceType: InvoiceType;
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate?: Date;
    partyId: string;
    partyName: string;
    partyGstin?: string;
    partyState?: string;
    subtotal: number;
    discountAmount: number;
    discountPercentage: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    tcsAmount: number;
    tcsPercentage: number;
    roundOff: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    isEinvoice: boolean;
    irn?: string;
    ackNumber?: string;
    ackDate?: Date;
    irnGeneratedAt?: Date;
    qrCodeUrl?: string;
    ewayBillNumber?: string;
    ewayBillDate?: Date;
    ewayBillValidUntil?: Date;
    vehicleNumber?: string;
    transporterId?: string;
    distance?: number;
    placeOfSupply?: string;
    reverseCharge: boolean;
    notes?: string;
    termsAndConditions?: string;
    isCancelled: boolean;
    cancelledAt?: Date;
    cancelledBy?: string;
    cancellationReason?: string;
    syncStatus: SyncStatus;
    pdfUrl?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IInvoiceItem {
    id: string;
    invoiceId: string;
    orgId: string;
    productId?: string;
    productName: string;
    productCode?: string;
    hsnCode: string;
    quantity: number;
    unit: string;
    rate: number;
    discountPercentage: number;
    discountAmount: number;
    taxableAmount: number;
    gstRate: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cessRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalAmount: number;
    createdAt: Date;
}

export interface IPayment {
    id: string;
    orgId: string;
    paymentType: PaymentType;
    paymentMode: PaymentMode;
    paymentDate: Date;
    partyId: string;
    partyName: string;
    amount: number;
    referenceNumber?: string;
    invoiceId?: string;
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: Date;
    chequeStatus?: string;
    upiTransactionId?: string;
    cardLast4Digits?: string;
    notes?: string;
    receiptUrl?: string;
    syncStatus: SyncStatus;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
// DTOs (Data Transfer Objects)

export interface CreateOrgDto {
    businessName: string;
    gstin?: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
}


export interface CreateUserDto {
    fullName: string;
    phone: string;
    email?: string;
    role: UserType;
}
export interface CreatePartyDto {
    partyType: PartyType;
    businessName: string;
    phone: string;
    email?: string;
    gstin?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    openingBalance?: number;
    creditLimit?: number;
    creditDays?: number;
}

export interface CreateProductDto {
    productCode: string;
    productName: string;
    description?: string;
    category?: string;
    hsnCode: string;
    gstRate: number;
    basePrice: number;
    unit: string;
    currentStock?: number;
}

export interface CreateInvoiceDto {
    invoiceType: InvoiceType;
    invoiceDate: Date;
    partyId: string;
    items: CreateInvoiceItemDto[];
    discountPercentage?: number;
    notes?: string;
}

export interface CreateInvoiceItemDto {
    productId?: string;
    productName: string;
    hsnCode: string;
    quantity: number;
    unit: string;
    rate: number;
    discountPercentage?: number;
    gstRate: number;
}

export interface CreatePaymentDto {
    paymentType: PaymentType;
    paymentMode: PaymentMode;
    paymentDate: Date;
    partyId: string;
    amount: number;
    invoiceId?: string;
    referenceNumber?: string;
    notes?: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
    timestamp: Date;
}

export interface PaginatedResponse<T = unknown> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: Omit<IUser, 'passwordHash'>;
    organization: IOrg;
}

export interface OTPResponse {
    success: boolean;
    message: string;
    expiresAt: Date;
}

// Query Filters
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface PartyFilters extends PaginationParams {
    partyType?: PartyType;
    search?: string;
    city?: string;
    state?: string;
    isActive?: boolean;
}

export interface InvoiceFilters extends PaginationParams {
    invoiceType?: InvoiceType;
    partyId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: 'paid' | 'unpaid' | 'partial';
}

export interface ProductFilters extends PaginationParams {
    category?: string;
    search?: string;
    isActive?: boolean;
    lowStock?: boolean;
}

// Report Types
export interface SalesReport {
    totalSales: number;
    totalInvoices: number;
    paidAmount: number;
    pendingAmount: number;
    topCustomers: Array<{
        partyId: string;
        partyName: string;
        totalAmount: number;
        invoiceCount: number;
    }>;
    topProducts: Array<{
        productId: string;
        productName: string;
        quantitySold: number;
        totalAmount: number;
    }>;
    dailySales: Array<{
        date: Date;
        totalAmount: number;
        invoiceCount: number;
    }>;
}

export interface OutstandingReport {
    totalOutstanding: number;
    totalCustomers: number;
    overdueAmount: number;
    overdueCustomers: number;
    customers: Array<{
        partyId: string;
        partyName: string;
        outstandingAmount: number;
        overdueAmount: number;
        lastPaymentDate?: Date;
    }>;
}

export interface GSTReport {
    totalSales: number;
    totalCGST: number;
    totalSGST: number;
    totalIGST: number;
    totalCess: number;
    b2bSales: number;
    b2cSales: number;
    exportSales: number;
}

// Sync Types
export interface SyncRequest {
    entityType: 'invoice' | 'payment' | 'party' | 'product';
    action: 'create' | 'update' | 'delete';
    localId: string;
    data: unknown;
    timestamp: Date;
}

export interface SyncResponse {
    success: boolean;
    serverId?: string;
    conflict?: boolean;
    serverData?: unknown;
}

export interface ConflictResolution {
    strategy: 'server-wins' | 'client-wins' | 'merge';
    resolvedData: unknown;
}


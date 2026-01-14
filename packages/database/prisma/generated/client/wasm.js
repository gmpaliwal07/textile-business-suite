
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.LedgerGroupScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  groupName: 'groupName',
  groupCode: 'groupCode',
  groupType: 'groupType',
  description: 'description',
  parentGroupId: 'parentGroupId',
  level: 'level',
  affects: 'affects',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
  isSystemLedger: 'isSystemLedger'
};

exports.Prisma.LedgerScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  ledgerName: 'ledgerName',
  ledgerCode: 'ledgerCode',
  ledgerType: 'ledgerType',
  ledgerGroupId: 'ledgerGroupId',
  openingBalance: 'openingBalance',
  openingDate: 'openingDate',
  currentBalance: 'currentBalance',
  partyId: 'partyId',
  bankName: 'bankName',
  accountNumber: 'accountNumber',
  ifscCode: 'ifscCode',
  branchName: 'branchName',
  taxType: 'taxType',
  taxRate: 'taxRate',
  isActive: 'isActive',
  isSystemLedger: 'isSystemLedger',
  description: 'description',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  expenseNumber: 'expenseNumber',
  expenseDate: 'expenseDate',
  expenseCategory: 'expenseCategory',
  ledgerId: 'ledgerId',
  ledgerName: 'ledgerName',
  amount: 'amount',
  paymentMode: 'paymentMode',
  paidFrom: 'paidFrom',
  billNumber: 'billNumber',
  vendorName: 'vendorName',
  vendorId: 'vendorId',
  voucherId: 'voucherId',
  description: 'description',
  attachmentUrl: 'attachmentUrl',
  isRecurring: 'isRecurring',
  recurringId: 'recurringId',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.RecurringExpenseScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  expenseCategory: 'expenseCategory',
  ledgerId: 'ledgerId',
  amount: 'amount',
  frequency: 'frequency',
  startDate: 'startDate',
  endDate: 'endDate',
  nextDueDate: 'nextDueDate',
  paymentMode: 'paymentMode',
  paidFrom: 'paidFrom',
  isActive: 'isActive',
  autoGenerate: 'autoGenerate',
  description: 'description',
  vendorName: 'vendorName',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.VoucherScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  voucherType: 'voucherType',
  voucherNumber: 'voucherNumber',
  voucherDate: 'voucherDate',
  referenceType: 'referenceType',
  referenceId: 'referenceId',
  referenceNumber: 'referenceNumber',
  narration: 'narration',
  totalDebit: 'totalDebit',
  totalCredit: 'totalCredit',
  isPosted: 'isPosted',
  isCancelled: 'isCancelled',
  cancelledAt: 'cancelledAt',
  cancelledBy: 'cancelledBy',
  cancellationReason: 'cancellationReason',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  editedBy: 'editedBy',
  editedAt: 'editedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.VoucherEntryScalarFieldEnum = {
  id: 'id',
  voucherId: 'voucherId',
  ledgerId: 'ledgerId',
  ledgerName: 'ledgerName',
  debitAmount: 'debitAmount',
  creditAmount: 'creditAmount',
  gstRate: 'gstRate',
  cgstAmount: 'cgstAmount',
  sgstAmount: 'sgstAmount',
  igstAmount: 'igstAmount',
  cessAmount: 'cessAmount',
  narration: 'narration',
  createdAt: 'createdAt'
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  businessName: 'businessName',
  legalName: 'legalName',
  gstin: 'gstin',
  pan: 'pan',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  country: 'country',
  phone: 'phone',
  email: 'email',
  website: 'website',
  logoUrl: 'logoUrl',
  financialYearStart: 'financialYearStart',
  currency: 'currency',
  timezone: 'timezone',
  defaultLanguage: 'defaultLanguage',
  subscriptionPlan: 'subscriptionPlan',
  subscriptionStatus: 'subscriptionStatus',
  trialEndsAt: 'trialEndsAt',
  subscriptionEndsAt: 'subscriptionEndsAt',
  invoicePrefix: 'invoicePrefix',
  invoiceCounter: 'invoiceCounter',
  booksBeginningDate: 'booksBeginningDate',
  currentFYStart: 'currentFYStart',
  currentFYEnd: 'currentFYEnd',
  businessType: 'businessType',
  isMigrationMode: 'isMigrationMode',
  booksLockedBefore: 'booksLockedBefore',
  isChartSetup: 'isChartSetup',
  isOpeningBalanceEntered: 'isOpeningBalanceEntered',
  openingBalanceDiff: 'openingBalanceDiff',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  fullName: 'fullName',
  email: 'email',
  phone: 'phone',
  passwordHash: 'passwordHash',
  phoneVerified: 'phoneVerified',
  emailVerified: 'emailVerified',
  role: 'role',
  permissions: 'permissions',
  language: 'language',
  avatarUrl: 'avatarUrl',
  lastLoginAt: 'lastLoginAt',
  lastLoginIp: 'lastLoginIp',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.PartyScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  partyType: 'partyType',
  partyCode: 'partyCode',
  businessName: 'businessName',
  contactPerson: 'contactPerson',
  phone: 'phone',
  email: 'email',
  whatsappNumber: 'whatsappNumber',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  gstin: 'gstin',
  pan: 'pan',
  openingBalance: 'openingBalance',
  creditLimit: 'creditLimit',
  creditDays: 'creditDays',
  ledgerId: 'ledgerId',
  notes: 'notes',
  tags: 'tags',
  isActive: 'isActive',
  syncStatus: 'syncStatus',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.ProductBatchScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  productId: 'productId',
  batchNumber: 'batchNumber',
  lotNumber: 'lotNumber',
  purchaseInvoiceId: 'purchaseInvoiceId',
  purchaseDate: 'purchaseDate',
  purchasePrice: 'purchasePrice',
  openingStock: 'openingStock',
  currentStock: 'currentStock',
  expiryDate: 'expiryDate',
  godownLocation: 'godownLocation',
  thaan: 'thaan',
  designNumber: 'designNumber',
  color: 'color',
  notes: 'notes',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  productCode: 'productCode',
  productName: 'productName',
  description: 'description',
  category: 'category',
  subcategory: 'subcategory',
  primaryImageUrl: 'primaryImageUrl',
  imageUrls: 'imageUrls',
  basePrice: 'basePrice',
  salePrice: 'salePrice',
  purchasePrice: 'purchasePrice',
  hsnCode: 'hsnCode',
  gstRate: 'gstRate',
  cessRate: 'cessRate',
  unit: 'unit',
  currentStock: 'currentStock',
  minStockLevel: 'minStockLevel',
  fabricType: 'fabricType',
  designNumber: 'designNumber',
  color: 'color',
  size: 'size',
  weight: 'weight',
  barcode: 'barcode',
  isActive: 'isActive',
  syncStatus: 'syncStatus',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.StockValuationScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  productId: 'productId',
  valuationDate: 'valuationDate',
  periodType: 'periodType',
  quantity: 'quantity',
  averagePrice: 'averagePrice',
  totalValue: 'totalValue',
  method: 'method',
  createdBy: 'createdBy',
  createdAt: 'createdAt'
};

exports.Prisma.OtherIncomeScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  incomeNumber: 'incomeNumber',
  incomeDate: 'incomeDate',
  incomeType: 'incomeType',
  ledgerId: 'ledgerId',
  ledgerName: 'ledgerName',
  amount: 'amount',
  receivedIn: 'receivedIn',
  receiptMode: 'receiptMode',
  referenceNumber: 'referenceNumber',
  partyName: 'partyName',
  voucherId: 'voucherId',
  description: 'description',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  invoiceType: 'invoiceType',
  invoiceNumber: 'invoiceNumber',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  partyId: 'partyId',
  partyName: 'partyName',
  partyGstin: 'partyGstin',
  partyState: 'partyState',
  deliveryAddressLine1: 'deliveryAddressLine1',
  deliveryAddressLine2: 'deliveryAddressLine2',
  deliveryCity: 'deliveryCity',
  deliveryState: 'deliveryState',
  deliveryPincode: 'deliveryPincode',
  subtotal: 'subtotal',
  discountAmount: 'discountAmount',
  discountPercentage: 'discountPercentage',
  cgstAmount: 'cgstAmount',
  sgstAmount: 'sgstAmount',
  igstAmount: 'igstAmount',
  cessAmount: 'cessAmount',
  tcsAmount: 'tcsAmount',
  tcsPercentage: 'tcsPercentage',
  roundOff: 'roundOff',
  totalAmount: 'totalAmount',
  paidAmount: 'paidAmount',
  balanceAmount: 'balanceAmount',
  isEinvoice: 'isEinvoice',
  irn: 'irn',
  ackNumber: 'ackNumber',
  ackDate: 'ackDate',
  irnGeneratedAt: 'irnGeneratedAt',
  qrCodeUrl: 'qrCodeUrl',
  ewayBillNumber: 'ewayBillNumber',
  ewayBillDate: 'ewayBillDate',
  ewayBillValidUntil: 'ewayBillValidUntil',
  vehicleNumber: 'vehicleNumber',
  transporterId: 'transporterId',
  distance: 'distance',
  transportMode: 'transportMode',
  transporterDocNumber: 'transporterDocNumber',
  transporterDocDate: 'transporterDocDate',
  placeOfSupply: 'placeOfSupply',
  reverseCharge: 'reverseCharge',
  notes: 'notes',
  termsAndConditions: 'termsAndConditions',
  isCancelled: 'isCancelled',
  cancelledAt: 'cancelledAt',
  cancelledBy: 'cancelledBy',
  cancellationReason: 'cancellationReason',
  syncStatus: 'syncStatus',
  pdfUrl: 'pdfUrl',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.InvoiceItemScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  organizationId: 'organizationId',
  productId: 'productId',
  productName: 'productName',
  productCode: 'productCode',
  hsnCode: 'hsnCode',
  quantity: 'quantity',
  unit: 'unit',
  rate: 'rate',
  discountPercentage: 'discountPercentage',
  discountAmount: 'discountAmount',
  taxableAmount: 'taxableAmount',
  gstRate: 'gstRate',
  cgstRate: 'cgstRate',
  sgstRate: 'sgstRate',
  igstRate: 'igstRate',
  cessRate: 'cessRate',
  cgstAmount: 'cgstAmount',
  sgstAmount: 'sgstAmount',
  igstAmount: 'igstAmount',
  cessAmount: 'cessAmount',
  costPrice: 'costPrice',
  cogsAmount: 'cogsAmount',
  profitAmount: 'profitAmount',
  profitMargin: 'profitMargin',
  totalAmount: 'totalAmount',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentAllocationScalarFieldEnum = {
  id: 'id',
  paymentId: 'paymentId',
  invoiceId: 'invoiceId',
  amount: 'amount',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  paymentType: 'paymentType',
  paymentMode: 'paymentMode',
  paymentDate: 'paymentDate',
  partyId: 'partyId',
  partyName: 'partyName',
  amount: 'amount',
  referenceNumber: 'referenceNumber',
  invoiceId: 'invoiceId',
  bankName: 'bankName',
  chequeNumber: 'chequeNumber',
  chequeDate: 'chequeDate',
  chequeStatus: 'chequeStatus',
  upiTransactionId: 'upiTransactionId',
  cardLast4Digits: 'cardLast4Digits',
  notes: 'notes',
  receiptUrl: 'receiptUrl',
  syncStatus: 'syncStatus',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.InventoryTransactionScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  productId: 'productId',
  transactionType: 'transactionType',
  quantity: 'quantity',
  unit: 'unit',
  referenceType: 'referenceType',
  referenceId: 'referenceId',
  referenceNumber: 'referenceNumber',
  stockBefore: 'stockBefore',
  stockAfter: 'stockAfter',
  transactionDate: 'transactionDate',
  notes: 'notes',
  createdBy: 'createdBy',
  createdAt: 'createdAt'
};

exports.Prisma.SyncLogScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  userId: 'userId',
  entityType: 'entityType',
  entityId: 'entityId',
  action: 'action',
  syncStatus: 'syncStatus',
  errorMessage: 'errorMessage',
  retryCount: 'retryCount',
  localData: 'localData',
  serverData: 'serverData',
  conflictData: 'conflictData',
  createdAt: 'createdAt',
  syncedAt: 'syncedAt',
  nextRetryAt: 'nextRetryAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  userId: 'userId',
  userName: 'userName',
  userRole: 'userRole',
  entityType: 'entityType',
  entityId: 'entityId',
  action: 'action',
  oldData: 'oldData',
  newData: 'newData',
  changes: 'changes',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.SettingsScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  invoiceTerms: 'invoiceTerms',
  invoiceFooter: 'invoiceFooter',
  showLogoOnInvoice: 'showLogoOnInvoice',
  showSignature: 'showSignature',
  signatureUrl: 'signatureUrl',
  printSize: 'printSize',
  autoPrint: 'autoPrint',
  whatsappEnabled: 'whatsappEnabled',
  whatsappTemplateId: 'whatsappTemplateId',
  smsEnabled: 'smsEnabled',
  emailEnabled: 'emailEnabled',
  enableEinvoice: 'enableEinvoice',
  einvoiceUsername: 'einvoiceUsername',
  einvoicePassword: 'einvoicePassword',
  gstPortalUsername: 'gstPortalUsername',
  gstPortalPassword: 'gstPortalPassword',
  lowStockAlert: 'lowStockAlert',
  paymentReminderDays: 'paymentReminderDays',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.GroupType = exports.$Enums.GroupType = {
  capital_account: 'capital_account',
  current_assets: 'current_assets',
  current_liabilities: 'current_liabilities',
  fixed_assets: 'fixed_assets',
  investments: 'investments',
  loans_liability: 'loans_liability',
  loans_asset: 'loans_asset',
  sales_accounts: 'sales_accounts',
  purchase_accounts: 'purchase_accounts',
  direct_expenses: 'direct_expenses',
  indirect_expenses: 'indirect_expenses',
  direct_incomes: 'direct_incomes',
  indirect_incomes: 'indirect_incomes',
  drawing_account: 'drawing_account'
};

exports.AffectsType = exports.$Enums.AffectsType = {
  balance_sheet: 'balance_sheet',
  profit_loss: 'profit_loss'
};

exports.LedgerType = exports.$Enums.LedgerType = {
  party_receivable: 'party_receivable',
  party_payable: 'party_payable',
  cash: 'cash',
  bank: 'bank',
  sales: 'sales',
  sales_return: 'sales_return',
  purchase: 'purchase',
  purchase_return: 'purchase_return',
  expense: 'expense',
  income: 'income',
  gst_input: 'gst_input',
  gst_output: 'gst_output',
  asset: 'asset',
  liability: 'liability',
  capital: 'capital',
  round_off: 'round_off'
};

exports.ExpenseCategory = exports.$Enums.ExpenseCategory = {
  rent: 'rent',
  salary: 'salary',
  electricity: 'electricity',
  water: 'water',
  telephone: 'telephone',
  internet: 'internet',
  transport: 'transport',
  courier: 'courier',
  stationery: 'stationery',
  printing: 'printing',
  repairs_maintenance: 'repairs_maintenance',
  insurance: 'insurance',
  legal_professional: 'legal_professional',
  bank_charges: 'bank_charges',
  interest: 'interest',
  advertisement: 'advertisement',
  commission: 'commission',
  brokerage: 'brokerage',
  travelling: 'travelling',
  entertainment: 'entertainment',
  depreciation: 'depreciation',
  misc: 'misc'
};

exports.PaymentMode = exports.$Enums.PaymentMode = {
  cash: 'cash',
  bank: 'bank',
  cheque: 'cheque',
  upi: 'upi',
  card: 'card',
  credit: 'credit'
};

exports.ExpenseFrequency = exports.$Enums.ExpenseFrequency = {
  one_time: 'one_time',
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  half_yearly: 'half_yearly',
  yearly: 'yearly'
};

exports.VoucherType = exports.$Enums.VoucherType = {
  sales: 'sales',
  purchase: 'purchase',
  receipt: 'receipt',
  payment: 'payment',
  journal: 'journal',
  contra: 'contra',
  debit_note: 'debit_note',
  credit_note: 'credit_note'
};

exports.Language = exports.$Enums.Language = {
  en: 'en',
  hi: 'hi',
  gu: 'gu'
};

exports.SubscriptionStatus = exports.$Enums.SubscriptionStatus = {
  trial: 'trial',
  active: 'active',
  expired: 'expired',
  cancelled: 'cancelled'
};

exports.UserRole = exports.$Enums.UserRole = {
  owner: 'owner',
  manager: 'manager',
  staff: 'staff',
  accountant: 'accountant'
};

exports.PartyType = exports.$Enums.PartyType = {
  customer: 'customer',
  supplier: 'supplier',
  both: 'both'
};

exports.SyncStatus = exports.$Enums.SyncStatus = {
  pending: 'pending',
  synced: 'synced',
  conflict: 'conflict',
  failed: 'failed'
};

exports.IncomeType = exports.$Enums.IncomeType = {
  interest_received: 'interest_received',
  commission_received: 'commission_received',
  discount_received: 'discount_received',
  scrap_sale: 'scrap_sale',
  asset_sale: 'asset_sale',
  rent_received: 'rent_received',
  misc_income: 'misc_income'
};

exports.InvoiceType = exports.$Enums.InvoiceType = {
  sale: 'sale',
  purchase: 'purchase',
  sale_return: 'sale_return',
  purchase_return: 'purchase_return'
};

exports.PaymentType = exports.$Enums.PaymentType = {
  received: 'received',
  paid: 'paid'
};

exports.Prisma.ModelName = {
  LedgerGroup: 'LedgerGroup',
  Ledger: 'Ledger',
  Expense: 'Expense',
  RecurringExpense: 'RecurringExpense',
  Voucher: 'Voucher',
  VoucherEntry: 'VoucherEntry',
  Organization: 'Organization',
  User: 'User',
  Party: 'Party',
  ProductBatch: 'ProductBatch',
  Product: 'Product',
  StockValuation: 'StockValuation',
  OtherIncome: 'OtherIncome',
  Invoice: 'Invoice',
  InvoiceItem: 'InvoiceItem',
  PaymentAllocation: 'PaymentAllocation',
  Payment: 'Payment',
  InventoryTransaction: 'InventoryTransaction',
  SyncLog: 'SyncLog',
  AuditLog: 'AuditLog',
  Settings: 'Settings'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)

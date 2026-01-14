import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@textile/database';
import {
    SalesReportDto,
    OutstandingReportDto,
    GSTReportDto,
    ProfitLossReportDto,
    InventoryReportDto,

} from './dto';

@Injectable()
export class ReportsService {
    constructor(private prisma: prisma.PrismaService) { }

    // ============================================
    // SALES REPORT - COMPLETE
    // ============================================
    async getSalesReport(organizationId: string, dto: SalesReportDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        const where: any = {
            organizationId,
            invoiceType: 'sale',
            isCancelled: false,
            deletedAt: null,
            invoiceDate: { gte: startDate, lte: endDate },
        };

        if (dto.partyId) where.partyId = dto.partyId;

        const invoices = await this.prisma.invoice.findMany({
            where,
            include: {
                party: {
                    select: {
                        businessName: true,
                        ledger: { select: { currentBalance: true } }
                    },
                },
                items: {
                    select: {
                        productId: true,
                        productName: true,
                        quantity: true,
                        totalAmount: true,
                        cogsAmount: true,
                        profitAmount: true,
                    },
                },
            },
            orderBy: { invoiceDate: 'asc' },
        });

        const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

        // Get actual paid from payment allocations
        const invoiceIds = invoices.map(inv => inv.id);
        const payments = await this.prisma.paymentAllocation.findMany({
            where: {
                invoiceId: { in: invoiceIds },
                payment: { organizationId, deletedAt: null }
            },
        });
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Get pending from ledger
        const uniquePartyIds = [...new Set(invoices.map(inv => inv.partyId))];
        const parties = await this.prisma.party.findMany({
            where: { id: { in: uniquePartyIds }, organizationId },
            select: { ledger: { select: { currentBalance: true } } }
        });
        const totalPending = parties.reduce(
            (sum, p) => sum + Math.max(0, Number(p.ledger?.currentBalance || 0)), 0
        );

        // Calculate total COGS and profit
        const totalCOGS = invoices.reduce((sum, inv) =>
            sum + inv.items.reduce((itemSum, item) => itemSum + Number(item.cogsAmount || 0), 0), 0
        );
        const totalProfit = invoices.reduce((sum, inv) =>
            sum + inv.items.reduce((itemSum, item) => itemSum + Number(item.profitAmount || 0), 0), 0
        );

        // Top customers
        const customerMap = new Map();
        invoices.forEach((inv) => {
            const existing = customerMap.get(inv.partyId) || {
                partyId: inv.partyId,
                partyName: inv.partyName,
                totalAmount: 0,
                totalProfit: 0,
                invoiceCount: 0,
            };
            existing.totalAmount += Number(inv.totalAmount);
            existing.totalProfit += inv.items.reduce((sum, item) => sum + Number(item.profitAmount || 0), 0);
            existing.invoiceCount += 1;
            customerMap.set(inv.partyId, existing);
        });
        const topCustomers = Array.from(customerMap.values())
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10)
            .map(c => ({
                ...c,
                profitMargin: c.totalAmount > 0 ? (c.totalProfit / c.totalAmount * 100) : 0,
            }));

        // Top products
        const productMap = new Map();
        invoices.forEach((inv) => {
            inv.items.forEach((item) => {
                const key = item.productId || item.productName;
                const existing = productMap.get(key) || {
                    productId: item.productId,
                    productName: item.productName,
                    quantitySold: 0,
                    totalAmount: 0,
                    totalCOGS: 0,
                    totalProfit: 0,
                };
                existing.quantitySold += Number(item.quantity);
                existing.totalAmount += Number(item.totalAmount);
                existing.totalCOGS += Number(item.cogsAmount || 0);
                existing.totalProfit += Number(item.profitAmount || 0);
                productMap.set(key, existing);
            });
        });
        const topProducts = Array.from(productMap.values())
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10)
            .map(p => ({
                ...p,
                profitMargin: p.totalAmount > 0 ? (p.totalProfit / p.totalAmount * 100) : 0,
            }));

        const groupedSales = this.groupSalesByPeriod(invoices, dto.groupBy || 'day');

        return {
            summary: {
                totalSales: Math.round(totalSales * 100) / 100,
                totalInvoices: invoices.length,
                totalPaid: Math.round(totalPaid * 100) / 100,
                totalPending: Math.round(totalPending * 100) / 100,
                totalCOGS: Math.round(totalCOGS * 100) / 100,
                totalProfit: Math.round(totalProfit * 100) / 100,
                averageInvoiceValue: invoices.length > 0
                    ? Math.round((totalSales / invoices.length) * 100) / 100 : 0,
                profitMargin: totalSales > 0 ? Math.round((totalProfit / totalSales) * 10000) / 100 : 0,
            },
            topCustomers,
            topProducts,
            salesTrend: groupedSales,
        };
    }

    private groupSalesByPeriod(invoices: any[], groupBy: string) {
        const grouped = new Map();
        invoices.forEach((inv) => {
            const date = new Date(inv.invoiceDate);
            let key: string;
            if (groupBy === 'day') {
                key = date.toISOString().split('T')[0];
            } else if (groupBy === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }
            const existing = grouped.get(key) || { date: key, totalAmount: 0, invoiceCount: 0 };
            existing.totalAmount += Number(inv.totalAmount);
            existing.invoiceCount += 1;
            grouped.set(key, existing);
        });
        return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    // ============================================
    // OUTSTANDING REPORT - COMPLETE
    // ============================================
    async getOutstandingReport(organizationId: string, dto: OutstandingReportDto) {
        const asOfDate = dto.asOfDate ? new Date(dto.asOfDate) : new Date();

        const where: any = {
            organizationId,
            isActive: true,
            deletedAt: null,
        };
        if (dto.partyType) where.partyType = dto.partyType;

        const parties = await this.prisma.party.findMany({
            where,
            select: {
                id: true,
                businessName: true,
                phone: true,
                creditLimit: true,
                creditDays: true,
                ledger: { select: { currentBalance: true } },
            },
        });

        const partiesWithBalance = parties.filter(
            (party) => Number(party.ledger?.currentBalance || 0) > 0
        );

        const partiesWithDetails = await Promise.all(
            partiesWithBalance.map(async (party) => {
                const invoices = await this.prisma.invoice.findMany({
                    where: {
                        organizationId,
                        partyId: party.id,
                        balanceAmount: { gt: 0 },
                        isCancelled: false,
                        deletedAt: null,
                        invoiceDate: { lte: asOfDate },
                    },
                    select: {
                        id: true,
                        invoiceNumber: true,
                        invoiceDate: true,
                        dueDate: true,
                        totalAmount: true,
                        balanceAmount: true,
                    },
                    orderBy: { invoiceDate: 'asc' },
                });

                // Calculate aging buckets
                const aging = {
                    current: 0,     // 0-30 days
                    days30to60: 0,  // 31-60 days
                    days60to90: 0,  // 61-90 days
                    above90: 0,     // 90+ days
                };

                invoices.forEach((inv) => {
                    const daysOld = Math.floor(
                        (asOfDate.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const balance = Number(inv.balanceAmount);

                    if (daysOld <= 30) aging.current += balance;
                    else if (daysOld <= 60) aging.days30to60 += balance;
                    else if (daysOld <= 90) aging.days60to90 += balance;
                    else aging.above90 += balance;
                });

                const overdueInvoices = invoices.filter((inv) => {
                    if (!inv.dueDate) return false;
                    return new Date(inv.dueDate) < asOfDate;
                });

                const overdueAmount = overdueInvoices.reduce(
                    (sum, inv) => sum + Number(inv.balanceAmount), 0
                );

                const lastPayment = await this.prisma.payment.findFirst({
                    where: {
                        organizationId,
                        partyId: party.id,
                        paymentType: 'received',
                        deletedAt: null,
                    },
                    orderBy: { paymentDate: 'desc' },
                    select: { paymentDate: true },
                });

                return {
                    partyId: party.id,
                    partyName: party.businessName,
                    phone: party.phone,
                    outstandingAmount: Number(party.ledger?.currentBalance || 0),
                    overdueAmount,
                    creditLimit: Number(party.creditLimit),
                    creditDays: party.creditDays,
                    aging: {
                        current: Math.round(aging.current * 100) / 100,
                        days30to60: Math.round(aging.days30to60 * 100) / 100,
                        days60to90: Math.round(aging.days60to90 * 100) / 100,
                        above90: Math.round(aging.above90 * 100) / 100,
                    },
                    overdueInvoices: overdueInvoices.length,
                    totalInvoices: invoices.length,
                    lastPaymentDate: lastPayment?.paymentDate,
                    invoices,
                };
            }),
        );

        let filteredParties = partiesWithDetails;
        if (dto.minAmount) {
            filteredParties = filteredParties.filter((p) => p.outstandingAmount >= Number(dto.minAmount));
        }
        if (dto.overdueOnly) {
            filteredParties = filteredParties.filter((p) => p.overdueAmount > 0);
        }

        filteredParties.sort((a, b) => b.outstandingAmount - a.outstandingAmount);

        const totalOutstanding = filteredParties.reduce((sum, p) => sum + p.outstandingAmount, 0);
        const totalOverdue = filteredParties.reduce((sum, p) => sum + p.overdueAmount, 0);

        // Calculate total aging
        const totalAging = {
            current: filteredParties.reduce((sum, p) => sum + p.aging.current, 0),
            days30to60: filteredParties.reduce((sum, p) => sum + p.aging.days30to60, 0),
            days60to90: filteredParties.reduce((sum, p) => sum + p.aging.days60to90, 0),
            above90: filteredParties.reduce((sum, p) => sum + p.aging.above90, 0),
        };

        return {
            summary: {
                totalOutstanding: Math.round(totalOutstanding * 100) / 100,
                totalOverdue: Math.round(totalOverdue * 100) / 100,
                totalParties: filteredParties.length,
                partiesWithOverdue: filteredParties.filter((p) => p.overdueAmount > 0).length,
                aging: {
                    current: Math.round(totalAging.current * 100) / 100,
                    days30to60: Math.round(totalAging.days30to60 * 100) / 100,
                    days60to90: Math.round(totalAging.days60to90 * 100) / 100,
                    above90: Math.round(totalAging.above90 * 100) / 100,
                },
            },
            parties: filteredParties,
        };
    }

    // ============================================
    // PROFIT & LOSS REPORT - COMPLETE
    // ============================================
    async getProfitLossReport(organizationId: string, dto: ProfitLossReportDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        // Revenue
        const salesInvoices = await this.prisma.invoice.findMany({
            where: {
                organizationId,
                invoiceType: 'sale',
                isCancelled: false,
                deletedAt: null,
                invoiceDate: { gte: startDate, lte: endDate },
            },
        });

        const salesReturns = await this.prisma.invoice.findMany({
            where: {
                organizationId,
                invoiceType: 'sale_return',
                isCancelled: false,
                deletedAt: null,
                invoiceDate: { gte: startDate, lte: endDate },
            },
        });

        const totalSales = salesInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const totalSalesReturns = salesReturns.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const netSales = totalSales - totalSalesReturns;

        // COGS from invoice items (actual FIFO cost)
        const salesItems = await this.prisma.invoiceItem.findMany({
            where: {
                organizationId,
                invoice: {
                    invoiceType: 'sale',
                    invoiceDate: { gte: startDate, lte: endDate },
                    isCancelled: false,
                    deletedAt: null,
                },
            },
        });

        const cogsFromItems = salesItems.reduce((sum, item) => sum + Number(item.cogsAmount || 0), 0);

        // Fallback: Stock formula if COGS not available
        const purchaseInvoices = await this.prisma.invoice.findMany({
            where: {
                organizationId,
                invoiceType: 'purchase',
                isCancelled: false,
                deletedAt: null,
                invoiceDate: { gte: startDate, lte: endDate },
            },
        });

        const purchaseReturns = await this.prisma.invoice.findMany({
            where: {
                organizationId,
                invoiceType: 'purchase_return',
                isCancelled: false,
                deletedAt: null,
                invoiceDate: { gte: startDate, lte: endDate },
            },
        });

        const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const totalPurchaseReturns = purchaseReturns.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const netPurchases = totalPurchases - totalPurchaseReturns;

        // Opening stock = closing of day before start date
        const dayBeforeStart = new Date(startDate);
        dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
        dayBeforeStart.setHours(23, 59, 59, 999);

        const openingStock = await this.calculateStockValueFromBatches(organizationId, dayBeforeStart);
        const closingStock = await this.calculateStockValueFromBatches(organizationId, endDate);

        const cogsFromStockFormula = openingStock + netPurchases - closingStock;
        const finalCOGS = cogsFromItems > 0 ? cogsFromItems : cogsFromStockFormula;

        const grossProfit = netSales - finalCOGS;
        const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

        // Expenses
        const directExpenses = await this.getExpensesByGroupType(
            organizationId, 'direct_expenses', startDate, endDate
        );
        const indirectExpenses = await this.getExpensesByGroupType(
            organizationId, 'indirect_expenses', startDate, endDate
        );
        const totalOperatingExpenses = directExpenses + indirectExpenses;

        // Other Income
        const otherIncome = await this.getOtherIncomeTotal(organizationId, startDate, endDate);

        const netProfitBeforeTax = grossProfit - totalOperatingExpenses + otherIncome;
        const netProfitMargin = netSales > 0 ? (netProfitBeforeTax / netSales) * 100 : 0;

        return {
            period: { startDate: dto.startDate, endDate: dto.endDate },
            revenue: {
                sales: Math.round(totalSales * 100) / 100,
                salesReturns: Math.round(totalSalesReturns * 100) / 100,
                netSales: Math.round(netSales * 100) / 100,
                salesCount: salesInvoices.length,
                returnsCount: salesReturns.length,
            },
            cogs: {
                method: cogsFromItems > 0 ? 'actual_cogs' : 'stock_formula',
                openingStock: Math.round(openingStock * 100) / 100,
                purchases: Math.round(totalPurchases * 100) / 100,
                purchaseReturns: Math.round(totalPurchaseReturns * 100) / 100,
                netPurchases: Math.round(netPurchases * 100) / 100,
                closingStock: Math.round(closingStock * 100) / 100,
                cogsFromFormula: Math.round(cogsFromStockFormula * 100) / 100,
                cogsFromItems: Math.round(cogsFromItems * 100) / 100,
                finalCOGS: Math.round(finalCOGS * 100) / 100,
            },
            grossProfit: {
                amount: Math.round(grossProfit * 100) / 100,
                margin: Math.round(grossProfitMargin * 100) / 100,
            },
            expenses: {
                directExpenses: Math.round(directExpenses * 100) / 100,
                indirectExpenses: Math.round(indirectExpenses * 100) / 100,
                totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
            },
            otherIncome: {
                amount: Math.round(otherIncome * 100) / 100,
            },
            netProfit: {
                amount: Math.round(netProfitBeforeTax * 100) / 100,
                margin: Math.round(netProfitMargin * 100) / 100,
            },
        };
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    private async calculateStockValueFromBatches(
        organizationId: string,
        date: Date
    ): Promise<number> {
        const batches = await this.prisma.productBatch.findMany({
            where: {
                organizationId,
                isActive: true,
                deletedAt: null,
                purchaseDate: { lte: date },
            },
            orderBy: { purchaseDate: 'asc' },
        });

        const totalValue = batches.reduce((sum, batch) => {
            const qty = Number(batch.currentStock);
            const price = Number(batch.purchasePrice);
            return qty > 0 ? sum + (qty * price) : sum;
        }, 0);

        return Math.round(totalValue * 100) / 100;
    }

    private async getExpensesByGroupType(
        organizationId: string,
        groupType: 'direct_expenses' | 'indirect_expenses',
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        const expenses = await this.prisma.expense.findMany({
            where: {
                organizationId,
                expenseDate: { gte: startDate, lte: endDate },
                deletedAt: null,
                ledger: { ledgerGroup: { groupType } },
            },
        });
        return expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    }

    private async getOtherIncomeTotal(
        organizationId: string,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        try {
            const incomes = await this.prisma.otherIncome.findMany({
                where: {
                    organizationId,
                    incomeDate: { gte: startDate, lte: endDate },
                    deletedAt: null,
                },
            });
            return incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
        } catch {
            return 0;
        }
    }


    // ============================================
    // ADD THESE METHODS TO ReportsService CLASS
    // ============================================

    // ============================================
    // PRODUCT-WISE PROFIT REPORT
    // ============================================
    async getProductProfitReport(
        organizationId: string,
        startDate: string,
        endDate: string
    ) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const salesItems = await this.prisma.invoiceItem.findMany({
            where: {
                organizationId,
                invoice: {
                    invoiceType: 'sale',
                    invoiceDate: { gte: start, lte: end },
                    isCancelled: false,
                    deletedAt: null,
                },
            },
            include: {
                invoice: {
                    select: {
                        invoiceDate: true,
                        invoiceNumber: true,
                        partyName: true,
                    },
                },
            },
        });

        const productMap = new Map();

        salesItems.forEach((item) => {
            const key = item.productId || item.productName;
            const existing = productMap.get(key) || {
                productId: item.productId,
                productCode: item.productCode,
                productName: item.productName,
                hsnCode: item.hsnCode,
                unit: item.unit,
                quantitySold: 0,
                salesValue: 0,
                totalCOGS: 0,
                totalProfit: 0,
                invoiceCount: new Set(),
            };

            existing.quantitySold += Number(item.quantity);
            existing.salesValue += Number(item.totalAmount);
            existing.totalCOGS += Number(item.cogsAmount || 0);
            existing.totalProfit += Number(item.profitAmount || 0);
            existing.invoiceCount.add(item.invoice.invoiceNumber);

            productMap.set(key, existing);
        });

        const products = Array.from(productMap.values())
            .map((p) => ({
                productId: p.productId,
                productCode: p.productCode,
                productName: p.productName,
                hsnCode: p.hsnCode,
                unit: p.unit,
                quantitySold: Math.round(p.quantitySold * 1000) / 1000,
                salesValue: Math.round(p.salesValue * 100) / 100,
                totalCOGS: Math.round(p.totalCOGS * 100) / 100,
                totalProfit: Math.round(p.totalProfit * 100) / 100,
                profitMargin: p.salesValue > 0
                    ? Math.round((p.totalProfit / p.salesValue) * 10000) / 100
                    : 0,
                averageSellingPrice: p.quantitySold > 0
                    ? Math.round((p.salesValue / p.quantitySold) * 100) / 100
                    : 0,
                averageCost: p.quantitySold > 0
                    ? Math.round((p.totalCOGS / p.quantitySold) * 100) / 100
                    : 0,
                invoiceCount: p.invoiceCount.size,
            }))
            .sort((a, b) => b.totalProfit - a.totalProfit);

        const summary = {
            totalProducts: products.length,
            totalSalesValue: products.reduce((sum, p) => sum + p.salesValue, 0),
            totalCOGS: products.reduce((sum, p) => sum + p.totalCOGS, 0),
            totalProfit: products.reduce((sum, p) => sum + p.totalProfit, 0),
            overallMargin: 0,
        };

        summary.overallMargin = summary.totalSalesValue > 0
            ? Math.round((summary.totalProfit / summary.totalSalesValue) * 10000) / 100
            : 0;

        // Identify problem products
        const lowMarginProducts = products.filter(p => p.profitMargin < 10);
        const lossProducts = products.filter(p => p.totalProfit < 0);

        return {
            period: { startDate, endDate },
            summary: {
                ...summary,
                totalSalesValue: Math.round(summary.totalSalesValue * 100) / 100,
                totalCOGS: Math.round(summary.totalCOGS * 100) / 100,
                totalProfit: Math.round(summary.totalProfit * 100) / 100,
            },
            products,
            insights: {
                lowMarginProducts,
                lossProducts,
                topPerformers: products.slice(0, 10),
            },
        };
    }

    // ============================================
    // STOCK AGING REPORT
    // ============================================
    async getStockAgingReport(organizationId: string) {
        const today = new Date();

        const batches = await this.prisma.productBatch.findMany({
            where: {
                organizationId,
                currentStock: { gt: 0 },
                isActive: true,
                deletedAt: null,
            },
            include: {
                product: {
                    select: {
                        productCode: true,
                        productName: true,
                        category: true,
                        unit: true,
                    },
                },
            },
            orderBy: { purchaseDate: 'asc' },
        });

        const agingBuckets = {
            days0to30: { count: 0, value: 0, batches: [] as any[] },
            days31to60: { count: 0, value: 0, batches: [] as any[] },
            days61to90: { count: 0, value: 0, batches: [] as any[] },
            days91to180: { count: 0, value: 0, batches: [] as any[] },
            above180: { count: 0, value: 0, batches: [] as any[] },
        };

        batches.forEach((batch) => {
            const ageInDays = Math.floor(
                (today.getTime() - new Date(batch.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
            );

            const qty = Number(batch.currentStock);
            const value = qty * Number(batch.purchasePrice);

            const batchData = {
                batchNumber: batch.batchNumber,
                productCode: batch.product.productCode,
                productName: batch.product.productName,
                category: batch.product.category,
                purchaseDate: batch.purchaseDate,
                ageInDays,
                quantity: Math.round(qty * 1000) / 1000,
                purchasePrice: Number(batch.purchasePrice),
                value: Math.round(value * 100) / 100,
                unit: batch.product.unit,
                godown: batch.godownLocation,
            };

            if (ageInDays <= 30) {
                agingBuckets.days0to30.count++;
                agingBuckets.days0to30.value += value;
                agingBuckets.days0to30.batches.push(batchData);
            } else if (ageInDays <= 60) {
                agingBuckets.days31to60.count++;
                agingBuckets.days31to60.value += value;
                agingBuckets.days31to60.batches.push(batchData);
            } else if (ageInDays <= 90) {
                agingBuckets.days61to90.count++;
                agingBuckets.days61to90.value += value;
                agingBuckets.days61to90.batches.push(batchData);
            } else if (ageInDays <= 180) {
                agingBuckets.days91to180.count++;
                agingBuckets.days91to180.value += value;
                agingBuckets.days91to180.batches.push(batchData);
            } else {
                agingBuckets.above180.count++;
                agingBuckets.above180.value += value;
                agingBuckets.above180.batches.push(batchData);
            }
        });

        const totalValue = batches.reduce(
            (sum, b) => sum + (Number(b.currentStock) * Number(b.purchasePrice)),
            0
        );

        return {
            summary: {
                totalBatches: batches.length,
                totalValue: Math.round(totalValue * 100) / 100,
                days0to30: {
                    count: agingBuckets.days0to30.count,
                    value: Math.round(agingBuckets.days0to30.value * 100) / 100,
                    percentage: totalValue > 0
                        ? Math.round((agingBuckets.days0to30.value / totalValue) * 10000) / 100
                        : 0,
                },
                days31to60: {
                    count: agingBuckets.days31to60.count,
                    value: Math.round(agingBuckets.days31to60.value * 100) / 100,
                    percentage: totalValue > 0
                        ? Math.round((agingBuckets.days31to60.value / totalValue) * 10000) / 100
                        : 0,
                },
                days61to90: {
                    count: agingBuckets.days61to90.count,
                    value: Math.round(agingBuckets.days61to90.value * 100) / 100,
                    percentage: totalValue > 0
                        ? Math.round((agingBuckets.days61to90.value / totalValue) * 10000) / 100
                        : 0,
                },
                days91to180: {
                    count: agingBuckets.days91to180.count,
                    value: Math.round(agingBuckets.days91to180.value * 100) / 100,
                    percentage: totalValue > 0
                        ? Math.round((agingBuckets.days91to180.value / totalValue) * 10000) / 100
                        : 0,
                },
                above180: {
                    count: agingBuckets.above180.count,
                    value: Math.round(agingBuckets.above180.value * 100) / 100,
                    percentage: totalValue > 0
                        ? Math.round((agingBuckets.above180.value / totalValue) * 10000) / 100
                        : 0,
                },
            },
            aging: {
                days0to30: agingBuckets.days0to30.batches,
                days31to60: agingBuckets.days31to60.batches,
                days61to90: agingBuckets.days61to90.batches,
                days91to180: agingBuckets.days91to180.batches,
                above180: agingBuckets.above180.batches,
            },
            warnings: {
                slowMoving: agingBuckets.days91to180.batches.concat(agingBuckets.above180.batches),
                slowMovingValue: Math.round(
                    (agingBuckets.days91to180.value + agingBuckets.above180.value) * 100
                ) / 100,
            },
        };
    }

    // ============================================
    // DAY BOOK REPORT
    // ============================================
    async getDayBook(
        organizationId: string,
        startDate: string,
        endDate: string
    ) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const vouchers = await this.prisma.voucher.findMany({
            where: {
                organizationId,
                voucherDate: { gte: start, lte: end },
                isPosted: true,
                isCancelled: false,
                deletedAt: null,
            },
            include: {
                entries: {
                    include: {
                        ledger: {
                            select: {
                                ledgerName: true,
                                ledgerType: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: [{ voucherDate: 'asc' }, { voucherNumber: 'asc' }],
        });

        const summary = {
            totalVouchers: vouchers.length,
            totalDebit: vouchers.reduce((sum, v) => sum + Number(v.totalDebit), 0),
            totalCredit: vouchers.reduce((sum, v) => sum + Number(v.totalCredit), 0),
            byType: {} as Record<string, { count: number; debit: number; credit: number }>,
        };

        vouchers.forEach((v) => {
            if (!summary.byType[v.voucherType]) {
                summary.byType[v.voucherType] = { count: 0, debit: 0, credit: 0 };
            }
            summary.byType[v.voucherType].count += 1;
            summary.byType[v.voucherType].debit += Number(v.totalDebit);
            summary.byType[v.voucherType].credit += Number(v.totalCredit);
        });

        // Round all values
        Object.keys(summary.byType).forEach((type) => {
            summary.byType[type].debit = Math.round(summary.byType[type].debit * 100) / 100;
            summary.byType[type].credit = Math.round(summary.byType[type].credit * 100) / 100;
        });

        return {
            period: { startDate, endDate },
            vouchers: vouchers.map(v => ({
                ...v,
                totalDebit: Math.round(Number(v.totalDebit) * 100) / 100,
                totalCredit: Math.round(Number(v.totalCredit) * 100) / 100,
                entries: v.entries.map(e => ({
                    ...e,
                    debitAmount: Math.round(Number(e.debitAmount) * 100) / 100,
                    creditAmount: Math.round(Number(e.creditAmount) * 100) / 100,
                })),
            })),
            summary: {
                ...summary,
                totalDebit: Math.round(summary.totalDebit * 100) / 100,
                totalCredit: Math.round(summary.totalCredit * 100) / 100,
            },
        };
    }

    // ============================================
    // LEDGER REPORT (Party/Product specific)
    // ============================================
    async getLedgerReport(
        organizationId: string,
        ledgerId: string,
        startDate: string,
        endDate: string
    ) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const ledger = await this.prisma.ledger.findFirst({
            where: { id: ledgerId, organizationId, deletedAt: null },
            include: { ledgerGroup: true, party: true },
        });

        if (!ledger) throw new NotFoundException('Ledger not found');

        // Get opening balance
        const openingEntries = await this.prisma.voucherEntry.findMany({
            where: {
                ledgerId,
                voucher: {
                    organizationId,
                    voucherDate: { lt: start },
                    isPosted: true,
                    isCancelled: false,
                    deletedAt: null,
                },
            },
        });

        let openingBalance = Number(ledger.openingBalance);
        openingEntries.forEach((entry) => {
            openingBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
        });

        // Get entries for the period
        const entries = await this.prisma.voucherEntry.findMany({
            where: {
                ledgerId,
                voucher: {
                    organizationId,
                    voucherDate: { gte: start, lte: end },
                    isPosted: true,
                    isCancelled: false,
                    deletedAt: null,
                },
            },
            include: {
                voucher: {
                    select: {
                        voucherNumber: true,
                        voucherType: true,
                        voucherDate: true,
                        narration: true,
                        referenceType: true,
                        referenceNumber: true,
                    },
                },
            },
            orderBy: [
                { voucher: { voucherDate: 'asc' } },
                { createdAt: 'asc' },
            ],
        });

        let runningBalance = openingBalance;
        const transactions = entries.map((entry) => {
            const debit = Number(entry.debitAmount);
            const credit = Number(entry.creditAmount);
            runningBalance += debit - credit;

            return {
                date: entry.voucher.voucherDate,
                voucherNumber: entry.voucher.voucherNumber,
                voucherType: entry.voucher.voucherType,
                referenceType: entry.voucher.referenceType,
                referenceNumber: entry.voucher.referenceNumber,
                narration: entry.voucher.narration || entry.narration,
                debit: debit > 0 ? Math.round(debit * 100) / 100 : 0,
                credit: credit > 0 ? Math.round(credit * 100) / 100 : 0,
                balance: Math.round(runningBalance * 100) / 100,
            };
        });

        const totalDebit = entries.reduce((sum, e) => sum + Number(e.debitAmount), 0);
        const totalCredit = entries.reduce((sum, e) => sum + Number(e.creditAmount), 0);

        return {
            period: { startDate, endDate },
            ledger: {
                id: ledger.id,
                ledgerName: ledger.ledgerName,
                ledgerType: ledger.ledgerType,
                groupName: ledger.ledgerGroup.groupName,
                partyName: ledger.party?.businessName,
                openingBalance: Math.round(openingBalance * 100) / 100,
                closingBalance: Math.round(runningBalance * 100) / 100,
            },
            transactions,
            summary: {
                totalDebit: Math.round(totalDebit * 100) / 100,
                totalCredit: Math.round(totalCredit * 100) / 100,
                netMovement: Math.round((totalDebit - totalCredit) * 100) / 100,
                transactionCount: entries.length,
            },
        };
    }

    // ============================================
    // PAYMENT COLLECTION REPORT
    // ============================================
    async getPaymentCollectionReport(
        organizationId: string,
        startDate: string,
        endDate: string
    ) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const payments = await this.prisma.payment.findMany({
            where: {
                organizationId,
                paymentType: 'received',
                paymentDate: { gte: start, lte: end },
                deletedAt: null,
            },
            include: {
                party: {
                    select: { businessName: true },
                },
                allocations: {
                    include: {
                        invoice: {
                            select: {
                                invoiceNumber: true,
                                invoiceDate: true,
                                totalAmount: true,
                            },
                        },
                    },
                },
            },
            orderBy: { paymentDate: 'asc' },
        });

        const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Group by payment mode
        const byMode = payments.reduce((acc, p) => {
            if (!acc[p.paymentMode]) {
                acc[p.paymentMode] = { count: 0, amount: 0 };
            }
            acc[p.paymentMode].count++;
            acc[p.paymentMode].amount += Number(p.amount);
            return acc;
        }, {} as Record<string, { count: number; amount: number }>);

        // Top paying customers
        const partyMap = new Map();
        payments.forEach((p) => {
            const existing = partyMap.get(p.partyId) || {
                partyId: p.partyId,
                partyName: p.partyName,
                totalPaid: 0,
                paymentCount: 0,
            };
            existing.totalPaid += Number(p.amount);
            existing.paymentCount++;
            partyMap.set(p.partyId, existing);
        });

        const topPayers = Array.from(partyMap.values())
            .sort((a, b) => b.totalPaid - a.totalPaid)
            .slice(0, 10);

        // Round values
        Object.keys(byMode).forEach((mode) => {
            byMode[mode].amount = Math.round(byMode[mode].amount * 100) / 100;
        });

        return {
            period: { startDate, endDate },
            summary: {
                totalCollected: Math.round(totalCollected * 100) / 100,
                paymentCount: payments.length,
                averagePayment: payments.length > 0
                    ? Math.round((totalCollected / payments.length) * 100) / 100
                    : 0,
                byMode,
            },
            topPayers: topPayers.map(p => ({
                ...p,
                totalPaid: Math.round(p.totalPaid * 100) / 100,
            })),
            payments: payments.map(p => ({
                paymentDate: p.paymentDate,
                partyName: p.partyName,
                amount: Math.round(Number(p.amount) * 100) / 100,
                paymentMode: p.paymentMode,
                referenceNumber: p.referenceNumber,
                chequeNumber: p.chequeNumber,
                allocations: p.allocations.map(a => ({
                    invoiceNumber: a.invoice.invoiceNumber,
                    invoiceDate: a.invoice.invoiceDate,
                    amount: Math.round(Number(a.amount) * 100) / 100,
                })),
            })),
        };
    }


    // ============================================
    // ADD THESE REMAINING METHODS TO ReportsService
    // Standard Accounting Reports + GST + Dashboard
    // ============================================

    // ============================================
    // GST REPORT (GSTR-1 / GSTR-3B)
    // ============================================
    async getGSTReport(organizationId: string, dto: GSTReportDto) {
        const startDate = new Date(dto.year, dto.month - 1, 1);
        const endDate = new Date(dto.year, dto.month, 0);

        const invoices = await this.prisma.invoice.findMany({
            where: {
                organizationId,
                isCancelled: false,
                deletedAt: null,
                invoiceDate: { gte: startDate, lte: endDate },
            },
            include: {
                party: {
                    select: { businessName: true, gstin: true, state: true },
                },
                items: true,
            },
        });

        const b2bInvoices = invoices.filter((inv) => inv.partyGstin);
        const b2cInvoices = invoices.filter((inv) => !inv.partyGstin);

        const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const totalCGST = invoices.reduce((sum, inv) => sum + Number(inv.cgstAmount), 0);
        const totalSGST = invoices.reduce((sum, inv) => sum + Number(inv.sgstAmount), 0);
        const totalIGST = invoices.reduce((sum, inv) => sum + Number(inv.igstAmount), 0);
        const totalCess = invoices.reduce((sum, inv) => sum + Number(inv.cessAmount), 0);

        // HSN Summary
        const hsnMap = new Map();
        invoices.forEach((inv) => {
            inv.items.forEach((item) => {
                const key = `${item.hsnCode}-${item.gstRate}`;
                const existing = hsnMap.get(key) || {
                    hsnCode: item.hsnCode,
                    description: item.productName,
                    uqc: item.unit.toUpperCase(),
                    gstRate: Number(item.gstRate),
                    quantity: 0,
                    totalValue: 0,
                    taxableValue: 0,
                    cgstAmount: 0,
                    sgstAmount: 0,
                    igstAmount: 0,
                    cessAmount: 0,
                };
                existing.quantity += Number(item.quantity);
                existing.totalValue += Number(item.totalAmount);
                existing.taxableValue += Number(item.taxableAmount);
                existing.cgstAmount += Number(item.cgstAmount);
                existing.sgstAmount += Number(item.sgstAmount);
                existing.igstAmount += Number(item.igstAmount);
                existing.cessAmount += Number(item.cessAmount || 0);
                hsnMap.set(key, existing);
            });
        });

        const hsnSummary = Array.from(hsnMap.values()).map((item) => ({
            hsnCode: item.hsnCode,
            description: item.description,
            uqc: item.uqc,
            totalQuantity: Math.round(item.quantity * 1000) / 1000,
            totalValue: Math.round(item.totalValue * 100) / 100,
            taxableValue: Math.round(item.taxableValue * 100) / 100,
            gstRate: item.gstRate,
            cgstAmount: Math.round(item.cgstAmount * 100) / 100,
            sgstAmount: Math.round(item.sgstAmount * 100) / 100,
            igstAmount: Math.round(item.igstAmount * 100) / 100,
            cessAmount: Math.round(item.cessAmount * 100) / 100,
            totalTax: Math.round((item.cgstAmount + item.sgstAmount + item.igstAmount + item.cessAmount) * 100) / 100,
        })).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));

        // Rate-wise Summary
        const rateMap = new Map();
        invoices.forEach((inv) => {
            inv.items.forEach((item) => {
                const rate = Number(item.gstRate);
                const existing = rateMap.get(rate) || {
                    gstRate: rate,
                    taxableValue: 0,
                    cgstAmount: 0,
                    sgstAmount: 0,
                    igstAmount: 0,
                    cessAmount: 0,
                    totalTax: 0,
                };
                existing.taxableValue += Number(item.taxableAmount);
                existing.cgstAmount += Number(item.cgstAmount);
                existing.sgstAmount += Number(item.sgstAmount);
                existing.igstAmount += Number(item.igstAmount);
                existing.cessAmount += Number(item.cessAmount || 0);
                existing.totalTax += Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount) + Number(item.cessAmount || 0);
                rateMap.set(rate, existing);
            });
        });

        const ratewiseSummary = Array.from(rateMap.values())
            .map((item) => ({
                gstRate: item.gstRate,
                taxableValue: Math.round(item.taxableValue * 100) / 100,
                cgstAmount: Math.round(item.cgstAmount * 100) / 100,
                sgstAmount: Math.round(item.sgstAmount * 100) / 100,
                igstAmount: Math.round(item.igstAmount * 100) / 100,
                cessAmount: Math.round(item.cessAmount * 100) / 100,
                totalTax: Math.round(item.totalTax * 100) / 100,
            }))
            .sort((a, b) => a.gstRate - b.gstRate);

        if (dto.reportType === 'GSTR1') {
            return {
                period: { month: dto.month, year: dto.year, startDate, endDate },
                summary: {
                    totalSales: Math.round(totalSales * 100) / 100,
                    totalTaxableValue: Math.round((totalSales - totalCGST - totalSGST - totalIGST - totalCess) * 100) / 100,
                    totalCGST: Math.round(totalCGST * 100) / 100,
                    totalSGST: Math.round(totalSGST * 100) / 100,
                    totalIGST: Math.round(totalIGST * 100) / 100,
                    totalCess: Math.round(totalCess * 100) / 100,
                    totalTax: Math.round((totalCGST + totalSGST + totalIGST + totalCess) * 100) / 100,
                },
                b2b: {
                    invoiceCount: b2bInvoices.length,
                    totalValue: Math.round(b2bInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0) * 100) / 100,
                    invoices: b2bInvoices.map((inv) => ({
                        invoiceNumber: inv.invoiceNumber,
                        invoiceDate: inv.invoiceDate,
                        partyName: inv.partyName,
                        gstin: inv.partyGstin,
                        placeOfSupply: inv.placeOfSupply,
                        reverseCharge: inv.reverseCharge,
                        invoiceValue: Math.round(Number(inv.totalAmount) * 100) / 100,
                        taxableValue: Math.round((Number(inv.subtotal) - Number(inv.discountAmount)) * 100) / 100,
                        cgst: Math.round(Number(inv.cgstAmount) * 100) / 100,
                        sgst: Math.round(Number(inv.sgstAmount) * 100) / 100,
                        igst: Math.round(Number(inv.igstAmount) * 100) / 100,
                    })),
                },
                b2c: {
                    invoiceCount: b2cInvoices.length,
                    totalValue: Math.round(b2cInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0) * 100) / 100,
                },
                hsnSummary,
                ratewiseSummary,
            };
        } else {
            return {
                period: { month: dto.month, year: dto.year },
                outwardSupplies: {
                    taxableValue: Math.round((totalSales - totalCGST - totalSGST - totalIGST) * 100) / 100,
                    cgst: Math.round(totalCGST * 100) / 100,
                    sgst: Math.round(totalSGST * 100) / 100,
                    igst: Math.round(totalIGST * 100) / 100,
                    cess: Math.round(totalCess * 100) / 100,
                },
                ratewiseSummary,
            };
        }
    }

    // ============================================
    // INVENTORY REPORT
    // ============================================
    async getInventoryReport(organizationId: string, dto: InventoryReportDto) {
        const where: any = {
            organizationId,
            isActive: true,
            deletedAt: null,
        };

        if (dto.category) where.category = dto.category;

        const products = await this.prisma.product.findMany({
            where,
            select: {
                id: true,
                productCode: true,
                productName: true,
                category: true,
                unit: true,
                currentStock: true,
                minStockLevel: true,
                basePrice: true,
                salePrice: true,
                purchasePrice: true,
            },
            orderBy: { currentStock: 'asc' },
        });

        const filteredProducts = dto.lowStockOnly
            ? products.filter(p => Number(p.currentStock) <= Number(p.minStockLevel))
            : products;

        const totalProducts = filteredProducts.length;
        const lowStockProducts = filteredProducts.filter(
            (p) => Number(p.currentStock) <= Number(p.minStockLevel)
        );

        const totalStockValue = filteredProducts.reduce(
            (sum, p) => sum + Number(p.currentStock) * Number(p.purchasePrice || p.salePrice || p.basePrice),
            0
        );

        return {
            summary: {
                totalProducts,
                lowStockCount: lowStockProducts.length,
                totalStockValue: Math.round(totalStockValue * 100) / 100,
            },
            products: filteredProducts.map(p => ({
                ...p,
                currentStock: Math.round(Number(p.currentStock) * 1000) / 1000,
                minStockLevel: Math.round(Number(p.minStockLevel) * 1000) / 1000,
                stockValue: Math.round(Number(p.currentStock) * Number(p.purchasePrice || p.salePrice || p.basePrice) * 100) / 100,
            })),
        };
    }

    // ============================================
    // DASHBOARD SUMMARY
    // ============================================
    async getDashboardSummary(organizationId: string) {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const monthSales = await this.prisma.invoice.aggregate({
            where: {
                organizationId,
                invoiceType: 'sale',
                isCancelled: false,
                deletedAt: null,
                invoiceDate: { gte: firstDayOfMonth },
            },
            _sum: { totalAmount: true },
            _count: true,
        });

        const parties = await this.prisma.party.findMany({
            where: { organizationId, isActive: true, deletedAt: null },
            select: { ledger: { select: { currentBalance: true } } },
        });

        const totalOutstanding = parties.reduce(
            (sum, party) => sum + Number(party.ledger?.currentBalance || 0), 0
        );
        const partiesWithOutstanding = parties.filter(
            (party) => Number(party.ledger?.currentBalance || 0) > 0
        ).length;

        const allProducts = await this.prisma.product.findMany({
            where: { organizationId, isActive: true, deletedAt: null },
            select: { currentStock: true, minStockLevel: true },
        });

        const lowStockCount = allProducts.filter(p =>
            Number(p.currentStock) <= Number(p.minStockLevel)
        ).length;

        const recentInvoices = await this.prisma.invoice.findMany({
            where: { organizationId, deletedAt: null },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                invoiceNumber: true,
                invoiceType: true,
                partyName: true,
                totalAmount: true,
                balanceAmount: true,
                invoiceDate: true,
            },
        });

        return {
            thisMonth: {
                sales: Math.round(Number(monthSales._sum.totalAmount || 0) * 100) / 100,
                invoiceCount: monthSales._count,
            },
            outstanding: {
                totalAmount: Math.round(totalOutstanding * 100) / 100,
                partyCount: partiesWithOutstanding,
            },
            inventory: {
                lowStockCount,
            },
            recentInvoices: recentInvoices.map(inv => ({
                ...inv,
                totalAmount: Math.round(Number(inv.totalAmount) * 100) / 100,
                balanceAmount: Math.round(Number(inv.balanceAmount) * 100) / 100,
            })),
        };
    }

    // ============================================
    // RATEWISE GST SUMMARY
    // ============================================
    async getRatewiseGSTSummary(
        organizationId: string,
        startDate: Date,
        endDate: Date,
        invoiceType?: 'sale' | 'purchase',
    ) {
        const where: any = {
            organizationId,
            isCancelled: false,
            deletedAt: null,
            invoiceDate: { gte: startDate, lte: endDate },
        };

        if (invoiceType) where.invoiceType = invoiceType;

        const invoices = await this.prisma.invoice.findMany({
            where,
            include: { items: true },
        });

        const rateMap = new Map<number, {
            rate: number;
            taxableValue: number;
            cgst: number;
            sgst: number;
            igst: number;
            cess: number;
            totalTax: number;
            invoiceCount: number;
            itemCount: number;
        }>();

        invoices.forEach((inv) => {
            inv.items.forEach((item) => {
                const rate = Number(item.gstRate);
                const existing = rateMap.get(rate) || {
                    rate,
                    taxableValue: 0,
                    cgst: 0,
                    sgst: 0,
                    igst: 0,
                    cess: 0,
                    totalTax: 0,
                    invoiceCount: 0,
                    itemCount: 0,
                };

                existing.taxableValue += Number(item.taxableAmount);
                existing.cgst += Number(item.cgstAmount);
                existing.sgst += Number(item.sgstAmount);
                existing.igst += Number(item.igstAmount);
                existing.cess += Number(item.cessAmount || 0);
                existing.totalTax += Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount) + Number(item.cessAmount || 0);
                existing.itemCount += 1;

                rateMap.set(rate, existing);
            });
        });

        invoices.forEach((inv) => {
            const rates = new Set(inv.items.map((item) => Number(item.gstRate)));
            rates.forEach((rate) => {
                const data = rateMap.get(rate);
                if (data) data.invoiceCount += 1;
            });
        });

        const summary = Array.from(rateMap.values())
            .map((item) => ({
                gstRate: item.rate,
                taxableValue: Math.round(item.taxableValue * 100) / 100,
                cgstAmount: Math.round(item.cgst * 100) / 100,
                sgstAmount: Math.round(item.sgst * 100) / 100,
                igstAmount: Math.round(item.igst * 100) / 100,
                cessAmount: Math.round(item.cess * 100) / 100,
                totalTax: Math.round(item.totalTax * 100) / 100,
                totalValue: Math.round((item.taxableValue + item.totalTax) * 100) / 100,
                invoiceCount: item.invoiceCount,
                itemCount: item.itemCount,
                effectiveRate: item.taxableValue > 0
                    ? Math.round((item.totalTax / item.taxableValue) * 10000) / 100 : 0,
            }))
            .sort((a, b) => a.gstRate - b.gstRate);

        const totals = {
            taxableValue: summary.reduce((sum, r) => sum + r.taxableValue, 0),
            cgstAmount: summary.reduce((sum, r) => sum + r.cgstAmount, 0),
            sgstAmount: summary.reduce((sum, r) => sum + r.sgstAmount, 0),
            igstAmount: summary.reduce((sum, r) => sum + r.igstAmount, 0),
            cessAmount: summary.reduce((sum, r) => sum + r.cessAmount, 0),
            totalTax: summary.reduce((sum, r) => sum + r.totalTax, 0),
            totalValue: summary.reduce((sum, r) => sum + r.totalValue, 0),
        };

        return {
            period: { startDate, endDate },
            invoiceType: invoiceType || 'all',
            summary,
            totals: {
                taxableValue: Math.round(totals.taxableValue * 100) / 100,
                cgstAmount: Math.round(totals.cgstAmount * 100) / 100,
                sgstAmount: Math.round(totals.sgstAmount * 100) / 100,
                igstAmount: Math.round(totals.igstAmount * 100) / 100,
                cessAmount: Math.round(totals.cessAmount * 100) / 100,
                totalTax: Math.round(totals.totalTax * 100) / 100,
                totalValue: Math.round(totals.totalValue * 100) / 100,
                invoiceCount: invoices.length,
                itemCount: summary.reduce((sum, r) => sum + r.itemCount, 0),
            },
        };
    }

    // ============================================
    // BALANCE SHEET
    // ============================================
    async getBalanceSheet(organizationId: string, asOfDate: string) {
        const date = new Date(asOfDate);

        const ledgers = await this.prisma.ledger.findMany({
            where: { organizationId, isActive: true, deletedAt: null },
            include: {
                ledgerGroup: {
                    select: { groupName: true, groupType: true, affects: true },
                },
            },
        });

        const financialYearStart = new Date(date.getFullYear(), 3, 1);
        if (date < financialYearStart) {
            financialYearStart.setFullYear(date.getFullYear() - 1);
        }

        const plReport = await this.getProfitLossReport(organizationId, {
            startDate: financialYearStart.toISOString().split('T')[0],
            endDate: asOfDate,
        });

        const netProfit = plReport.netProfit.amount;

        const assets = {
            currentAssets: [] as any[],
            fixedAssets: [] as any[],
            investments: [] as any[],
            loansAsset: [] as any[],
            total: 0,
        };

        const liabilities = {
            currentLiabilities: [] as any[],
            loansLiability: [] as any[],
            total: 0,
        };

        const capital = {
            openingCapital: 0,
            netProfit: netProfit,
            drawings: 0,
            reservesSurplus: 0,
            total: 0,
        };

        ledgers.forEach((ledger) => {
            const balance = Number(ledger.currentBalance);
            const groupType = ledger.ledgerGroup.groupType;

            if (balance === 0) return;

            switch (groupType) {
                case 'current_assets':
                    assets.currentAssets.push({ ledgerName: ledger.ledgerName, balance: Math.abs(balance) });
                    assets.total += Math.abs(balance);
                    break;
                case 'fixed_assets':
                    assets.fixedAssets.push({ ledgerName: ledger.ledgerName, balance: Math.abs(balance) });
                    assets.total += Math.abs(balance);
                    break;
                case 'investments':
                    assets.investments.push({ ledgerName: ledger.ledgerName, balance: Math.abs(balance) });
                    assets.total += Math.abs(balance);
                    break;
                case 'loans_asset':
                    assets.loansAsset.push({ ledgerName: ledger.ledgerName, balance: Math.abs(balance) });
                    assets.total += Math.abs(balance);
                    break;
                case 'current_liabilities':
                    liabilities.currentLiabilities.push({ ledgerName: ledger.ledgerName, balance: Math.abs(balance) });
                    liabilities.total += Math.abs(balance);
                    break;
                case 'loans_liability':
                    liabilities.loansLiability.push({ ledgerName: ledger.ledgerName, balance: Math.abs(balance) });
                    liabilities.total += Math.abs(balance);
                    break;
                case 'capital_account':
                    capital.openingCapital += Math.abs(balance);
                    break;
                case 'drawing_account':
                    capital.drawings += Math.abs(balance);
                    break;
            }
        });

        const closingStockValue = await this.calculateStockValueFromBatches(organizationId, date);

        if (closingStockValue > 0) {
            assets.currentAssets.push({ ledgerName: 'Closing Stock', balance: closingStockValue });
            assets.total += closingStockValue;
        }

        capital.total = capital.openingCapital + netProfit - capital.drawings + capital.reservesSurplus;
        const totalLiabilitiesAndCapital = liabilities.total + capital.total;
        const difference = assets.total - totalLiabilitiesAndCapital;
        const isBalanced = Math.abs(difference) < 1;

        return {
            asOfDate,
            assets: {
                currentAssets: {
                    items: assets.currentAssets.map(a => ({ ...a, balance: Math.round(a.balance * 100) / 100 })),
                    total: Math.round(assets.currentAssets.reduce((sum, a) => sum + a.balance, 0) * 100) / 100,
                },
                fixedAssets: {
                    items: assets.fixedAssets.map(a => ({ ...a, balance: Math.round(a.balance * 100) / 100 })),
                    total: Math.round(assets.fixedAssets.reduce((sum, a) => sum + a.balance, 0) * 100) / 100,
                },
                investments: {
                    items: assets.investments.map(a => ({ ...a, balance: Math.round(a.balance * 100) / 100 })),
                    total: Math.round(assets.investments.reduce((sum, a) => sum + a.balance, 0) * 100) / 100,
                },
                loansAsset: {
                    items: assets.loansAsset.map(a => ({ ...a, balance: Math.round(a.balance * 100) / 100 })),
                    total: Math.round(assets.loansAsset.reduce((sum, a) => sum + a.balance, 0) * 100) / 100,
                },
                totalAssets: Math.round(assets.total * 100) / 100,
            },
            liabilities: {
                currentLiabilities: {
                    items: liabilities.currentLiabilities.map(l => ({ ...l, balance: Math.round(l.balance * 100) / 100 })),
                    total: Math.round(liabilities.currentLiabilities.reduce((sum, l) => sum + l.balance, 0) * 100) / 100,
                },
                loansLiability: {
                    items: liabilities.loansLiability.map(l => ({ ...l, balance: Math.round(l.balance * 100) / 100 })),
                    total: Math.round(liabilities.loansLiability.reduce((sum, l) => sum + l.balance, 0) * 100) / 100,
                },
                totalLiabilities: Math.round(liabilities.total * 100) / 100,
            },
            capital: {
                openingCapital: Math.round(capital.openingCapital * 100) / 100,
                netProfit: Math.round(netProfit * 100) / 100,
                drawings: Math.round(capital.drawings * 100) / 100,
                reservesSurplus: Math.round(capital.reservesSurplus * 100) / 100,
                totalCapital: Math.round(capital.total * 100) / 100,
            },
            totalLiabilitiesAndCapital: Math.round(totalLiabilitiesAndCapital * 100) / 100,
            isBalanced,
            difference: Math.round(difference * 100) / 100,
            ...((!isBalanced) && {
                warning: 'Balance Sheet is not balanced. Check voucher entries.',
            }),
        };
    }

    // ============================================
    // TRIAL BALANCE
    // ============================================
    async getTrialBalance(organizationId: string, asOfDate: string) {
        const ledgers = await this.prisma.ledger.findMany({
            where: { organizationId, deletedAt: null },
            include: { ledgerGroup: true },
        });

        const trial = ledgers.map(l => ({
            ledgerName: l.ledgerName,
            groupName: l.ledgerGroup.groupName,
            debit: Number(l.currentBalance) > 0 ? Number(l.currentBalance) : 0,
            credit: Number(l.currentBalance) < 0 ? Math.abs(Number(l.currentBalance)) : 0,
        }));

        const totalDebit = trial.reduce((sum, t) => sum + t.debit, 0);
        const totalCredit = trial.reduce((sum, t) => sum + t.credit, 0);

        return {
            asOfDate,
            ledgers: trial.filter(t => t.debit > 0 || t.credit > 0).map(t => ({
                ...t,
                debit: Math.round(t.debit * 100) / 100,
                credit: Math.round(t.credit * 100) / 100,
            })),
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
            isBalanced: Math.abs(totalDebit - totalCredit) < 1,
            difference: Math.round((totalDebit - totalCredit) * 100) / 100,
        };
    }
    // ============================================
    // CASH BOOK (Complete)
    // ============================================
    async getCashBook(organizationId: string, startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const cashLedger = await this.prisma.ledger.findFirst({
            where: { organizationId, ledgerType: 'cash', deletedAt: null }
        });

        if (!cashLedger) throw new NotFoundException('Cash ledger not found');

        const entries = await this.prisma.voucherEntry.findMany({
            where: {
                ledgerId: cashLedger.id,
                voucher: {
                    organizationId,
                    voucherDate: { gte: start, lte: end },
                    isPosted: true,
                    isCancelled: false,
                    deletedAt: null,
                },
            },
            include: {
                voucher: {
                    select: {
                        voucherNumber: true,
                        voucherType: true,
                        voucherDate: true,
                        narration: true,
                    }
                }
            },
            orderBy: [
                { voucher: { voucherDate: 'asc' } },
                { createdAt: 'asc' },
            ]
        });

        const openingEntries = await this.prisma.voucherEntry.findMany({
            where: {
                ledgerId: cashLedger.id,
                voucher: {
                    organizationId,
                    voucherDate: { lt: start },
                    isPosted: true,
                    isCancelled: false,
                    deletedAt: null,
                },
            },
        });

        let openingBalance = Number(cashLedger.openingBalance);
        openingEntries.forEach((entry) => {
            openingBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
        });

        let runningBalance = openingBalance;
        const transactions = entries.map((entry) => {
            const debit = Number(entry.debitAmount);
            const credit = Number(entry.creditAmount);
            runningBalance += debit - credit;

            return {
                date: entry.voucher.voucherDate,
                voucherNumber: entry.voucher.voucherNumber,
                voucherType: entry.voucher.voucherType,
                narration: entry.voucher.narration,
                debit: debit > 0 ? Math.round(debit * 100) / 100 : 0,
                credit: credit > 0 ? Math.round(credit * 100) / 100 : 0,
                balance: Math.round(runningBalance * 100) / 100,
            };
        });

        const totalDebit = entries.reduce((sum, e) => sum + Number(e.debitAmount), 0);
        const totalCredit = entries.reduce((sum, e) => sum + Number(e.creditAmount), 0);

        return {
            period: { startDate, endDate },
            ledger: {
                name: cashLedger.ledgerName,
                openingBalance: Math.round(openingBalance * 100) / 100,
                closingBalance: Math.round(runningBalance * 100) / 100,
            },
            transactions,
            summary: {
                totalReceipts: Math.round(totalDebit * 100) / 100,
                totalPayments: Math.round(totalCredit * 100) / 100,
                netChange: Math.round((totalDebit - totalCredit) * 100) / 100,
            },
        };
    }

    // ============================================
    // BANK BOOK
    // ============================================
    async getBankBook(organizationId: string, startDate: string, endDate: string, bankLedgerId?: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        let bankLedger;
        if (bankLedgerId) {
            bankLedger = await this.prisma.ledger.findFirst({
                where: { id: bankLedgerId, organizationId, ledgerType: 'bank', deletedAt: null },
            });
        } else {
            bankLedger = await this.prisma.ledger.findFirst({
                where: { organizationId, ledgerType: 'bank', deletedAt: null },
            });
        }

        if (!bankLedger) throw new NotFoundException('Bank ledger not found');

        const entries = await this.prisma.voucherEntry.findMany({
            where: {
                ledgerId: bankLedger.id,
                voucher: {
                    organizationId,
                    voucherDate: { gte: start, lte: end },
                    isPosted: true,
                    isCancelled: false,
                    deletedAt: null,
                },
            },
            include: {
                voucher: {
                    select: {
                        voucherNumber: true,
                        voucherType: true,
                        voucherDate: true,
                        narration: true,
                    },
                },
            },
            orderBy: [
                { voucher: { voucherDate: 'asc' } },
                { createdAt: 'asc' },
            ],
        });

        const openingEntries = await this.prisma.voucherEntry.findMany({
            where: {
                ledgerId: bankLedger.id,
                voucher: {
                    organizationId,
                    voucherDate: { lt: start },
                    isPosted: true,
                    isCancelled: false,
                    deletedAt: null,
                },
            },
        });

        let openingBalance = Number(bankLedger.openingBalance);
        openingEntries.forEach((entry) => {
            openingBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
        });

        let runningBalance = openingBalance;
        const transactions = entries.map((entry) => {
            const debit = Number(entry.debitAmount);
            const credit = Number(entry.creditAmount);
            runningBalance += debit - credit;

            return {
                date: entry.voucher.voucherDate,
                voucherNumber: entry.voucher.voucherNumber,
                voucherType: entry.voucher.voucherType,
                narration: entry.voucher.narration,
                deposit: debit > 0 ? Math.round(debit * 100) / 100 : 0,
                withdrawal: credit > 0 ? Math.round(credit * 100) / 100 : 0,
                balance: Math.round(runningBalance * 100) / 100,
            };
        });

        const totalDeposits = entries.reduce((sum, e) => sum + Number(e.debitAmount), 0);
        const totalWithdrawals = entries.reduce((sum, e) => sum + Number(e.creditAmount), 0);

        return {
            period: { startDate, endDate },
            ledger: {
                id: bankLedger.id,
                name: bankLedger.ledgerName,
                bankName: bankLedger.bankName,
                accountNumber: bankLedger.accountNumber,
                openingBalance: Math.round(openingBalance * 100) / 100,
                closingBalance: Math.round(runningBalance * 100) / 100,
            },
            transactions,
            summary: {
                totalDeposits: Math.round(totalDeposits * 100) / 100,
                totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
                netChange: Math.round((totalDeposits - totalWithdrawals) * 100) / 100,
            },
        };
    }

    // ============================================
    // GET ALL BANK LEDGERS
    // ============================================
    async getBankLedgers(organizationId: string) {
        return this.prisma.ledger.findMany({
            where: {
                organizationId,
                ledgerType: 'bank',
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                ledgerName: true,
                bankName: true,
                accountNumber: true,
                currentBalance: true,
            },
            orderBy: { ledgerName: 'asc' },
        });
    }

}


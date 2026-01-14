import { Controller, Get, Query, UseGuards, Req, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import {
    SalesReportDto,
    OutstandingReportDto,
    GSTReportDto,
    ProfitLossReportDto,
    InventoryReportDto,
    RatewiseGSTDto,
    DateRangeDto,

} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }


    @Get('dashboard')
    @ApiOperation({ summary: 'Get dashboard summary' })
    async getDashboard(@Req() req: any) {
        return this.reportsService.getDashboardSummary(req.user.organizationId);
    }

    @Get('sales')
    @ApiOperation({ summary: 'Get sales report with profitability' })
    async getSalesReport(@Req() req: any, @Query() dto: SalesReportDto) {
        return this.reportsService.getSalesReport(req.user.organizationId, dto);
    }

    @Get('product-profit')
    @ApiOperation({ summary: 'Get product-wise profit analysis' })
    async getProductProfit(@Req() req: any, @Query() dto: DateRangeDto) {
        return this.reportsService.getProductProfitReport(
            req.user.organizationId,
            dto.startDate,
            dto.endDate,
        );
    }


    @Get('outstanding')
    @ApiOperation({ summary: 'Get outstanding report with aging buckets' })
    async getOutstandingReport(@Req() req: any, @Query() dto: OutstandingReportDto) {
        return this.reportsService.getOutstandingReport(req.user.organizationId, dto);
    }

    @Get('payment-collection')
    @ApiOperation({ summary: 'Get payment collection report' })
    async getPaymentCollection(@Req() req: any, @Query() dto: DateRangeDto) {
        return this.reportsService.getPaymentCollectionReport(
            req.user.organizationId,
            dto.startDate,
            dto.endDate,
        );
    }


    @Get('gst')
    @ApiOperation({ summary: 'Get GST report (GSTR-1 / GSTR-3B)' })
    async getGSTReport(@Req() req: any, @Query() dto: GSTReportDto) {
        return this.reportsService.getGSTReport(req.user.organizationId, dto);
    }

    @Get('gst/ratewise')
    @ApiOperation({ summary: 'Get rate-wise GST summary' })
    getRatewiseGST(
        @CurrentUser('organizationId') organizationId: string,
        @Query() dto: RatewiseGSTDto,
    ) {
        return this.reportsService.getRatewiseGSTSummary(
            organizationId,
            new Date(dto.startDate),
            new Date(dto.endDate),
            dto.invoiceType,
        );
    }

   
    @Get('profit-loss')
    @ApiOperation({ summary: 'Get profit & loss statement' })
    async getProfitLoss(@Req() req: any, @Query() dto: ProfitLossReportDto) {
        return this.reportsService.getProfitLossReport(req.user.organizationId, dto);
    }

    @Get('balance-sheet')
    @ApiOperation({ summary: 'Get balance sheet' })
    async getBalanceSheet(
        @Req() req: any,
        @Query('asOfDate') asOfDate: string,
    ) {
        return this.reportsService.getBalanceSheet(
            req.user.organizationId,
            asOfDate || new Date().toISOString().split('T')[0],
        );
    }

    @Get('trial-balance')
    @ApiOperation({ summary: 'Get trial balance' })
    async getTrialBalance(
        @Req() req: any,
        @Query('asOfDate') asOfDate: string,
    ) {
        return this.reportsService.getTrialBalance(
            req.user.organizationId,
            asOfDate || new Date().toISOString().split('T')[0],
        );
    }


    @Get('inventory')
    @ApiOperation({ summary: 'Get inventory report' })
    async getInventory(@Req() req: any, @Query() dto: InventoryReportDto) {
        return this.reportsService.getInventoryReport(req.user.organizationId, dto);
    }

    @Get('stock-aging')
    @ApiOperation({ summary: 'Get stock aging report (slow-moving analysis)' })
    async getStockAging(@Req() req: any) {
        return this.reportsService.getStockAgingReport(req.user.organizationId);
    }


    @Get('cash-book')
    @ApiOperation({ summary: 'Get cash book' })
    async getCashBook(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.getCashBook(
            req.user.organizationId,
            startDate,
            endDate,
        );
    }

    @Get('bank-book')
    @ApiOperation({ summary: 'Get bank book' })
    async getBankBook(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('bankLedgerId') bankLedgerId?: string,
    ) {
        return this.reportsService.getBankBook(
            req.user.organizationId,
            startDate,
            endDate,
            bankLedgerId,
        );
    }

    @Get('bank-ledgers')
    @ApiOperation({ summary: 'Get all bank ledgers (for dropdown)' })
    async getBankLedgers(@Req() req: any) {
        return this.reportsService.getBankLedgers(req.user.organizationId);
    }

    @Get('day-book')
    @ApiOperation({ summary: 'Get day book (all vouchers)' })
    async getDayBook(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.getDayBook(
            req.user.organizationId,
            startDate,
            endDate,
        );
    }

    @Get('ledger/:ledgerId')
    @ApiOperation({ summary: 'Get ledger report (party/product specific)' })
    async getLedgerReport(
        @Req() req: any,
        @Param('ledgerId') ledgerId: string,
        @Query() dto: DateRangeDto,
    ) {
        return this.reportsService.getLedgerReport(
            req.user.organizationId,
            ledgerId,
            dto.startDate,
            dto.endDate,
        );
    }
}
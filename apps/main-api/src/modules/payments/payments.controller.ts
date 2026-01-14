import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import {
    CreatePaymentDto,
    UpdatePaymentDto,
    PaymentFiltersDto,
    CreateBillwisePaymentDto,
    AdjustAdvancePaymentDto,
    HandleChequeBounceDto
} from './dto';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    // ============================================
    // ✅ NEW: BILL-WISE PAYMENT ENDPOINTS
    // ============================================

    @Post('billwise')
    @ApiOperation({
        summary: 'Create bill-wise payment (Tally style - RECOMMENDED)',
        description: 'Supports multiple invoices, partial payments, and advance payments. This is the preferred method for creating payments.'
    })
    async createBillwise(@Req() req: any, @Body() dto: CreateBillwisePaymentDto) {
        return this.paymentsService.createBillwisePayment(
            req.user.organizationId,
            dto,
            req.user.id
        );
    }

    @Get('billwise/:id')
    @ApiOperation({ summary: 'Get bill-wise payment with allocations' })
    async findBillwise(@Req() req: any, @Param('id') id: string) {
        return this.paymentsService.findBillwisePaymentById(
            req.user.organizationId,
            id
        );
    }

    // ============================================
    // OLD: SINGLE PAYMENT ENDPOINTS (BACKWARD COMPATIBLE)
    // ============================================

    @Post()
    @ApiOperation({
        summary: 'Record new payment (Legacy - single invoice only)',
        description: 'DEPRECATED: Use POST /payments/billwise instead for better functionality',
        deprecated: true
    })
    async create(@Req() req: any, @Body() dto: CreatePaymentDto) {
        return this.paymentsService.create(req.user.organizationId, dto, req.user.id);
    }

    // ============================================
    // QUERY ENDPOINTS
    // ============================================

    @Get()
    @ApiOperation({ summary: 'Get all payments with filters' })
    async findAll(@Req() req: any, @Query() filters: PaymentFiltersDto) {
        return this.paymentsService.findAll(req.user.organizationId, filters);
    }

    @Get('summary')
    @ApiOperation({ summary: 'Get payment summary' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    async getSummary(
        @Req() req: any,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.paymentsService.getPaymentSummary(req.user.organizationId, startDate, endDate);
    }

    @Get('invoice/:invoiceId')
    @ApiOperation({
        summary: 'Get payments for specific invoice',
        description: 'Returns both old-style (single invoice) and new-style (bill-wise allocated) payments'
    })
    async getInvoicePayments(@Req() req: any, @Param('invoiceId') invoiceId: string) {
        return this.paymentsService.getInvoicePayments(req.user.organizationId, invoiceId);
    }

    @Get('party/:partyId')
    @ApiOperation({ summary: 'Get payments for specific party' })
    async getPartyPayments(@Req() req: any, @Param('partyId') partyId: string) {
        return this.paymentsService.getPartyPayments(req.user.organizationId, partyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get payment by ID' })
    async findOne(@Req() req: any, @Param('id') id: string) {
        return this.paymentsService.findById(req.user.organizationId, id);
    }

    // ============================================
    // UPDATE & DELETE ENDPOINTS
    // ============================================

    @Put(':id')
    @ApiOperation({ summary: 'Update payment' })
    async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
        return this.paymentsService.update(req.user.organizationId, id, dto);
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Delete payment',
        description: 'Reverses all invoice allocations and accounting vouchers'
    })
    async remove(@Req() req: any, @Param('id') id: string) {
        return this.paymentsService.remove(req.user.organizationId, id);
    }



    // ============================================
    // ADVANCE PAYMENT MANAGEMENT
    // ============================================

    @Post('adjust-advance')
    @ApiOperation({
        summary: 'Adjust advance payment against invoice',
        description: 'Applies a portion of an existing advance/on-account payment to a specific invoice. ' +
            'Useful when customer pays in advance and you need to adjust it against later invoices.'
    })
    @ApiResponse({ status: 200, description: 'Advance adjusted successfully' })
    @ApiResponse({ status: 400, description: 'Insufficient advance balance or validation error' })
    async adjustAdvance(@Req() req: any, @Body() dto: AdjustAdvancePaymentDto) {
        return this.paymentsService.adjustAdvancePayment(
            req.user.organizationId,
            dto,
            req.user.id
        );
    }

    // ============================================
    // CHEQUE MANAGEMENT
    // ============================================

    @Post(':id/cheque-bounce')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Handle cheque bounce',
        description: 'Reverses a cheque payment when it bounces. ' +
            'This will:\n' +
            '- Mark cheque as bounced\n' +
            '- Reverse all invoice allocations\n' +
            '- Reverse accounting voucher\n' +
            '- Optionally record bank charges'
    })
    @ApiResponse({ status: 200, description: 'Cheque bounce handled successfully' })
    @ApiResponse({ status: 400, description: 'Payment is not a cheque or already bounced' })
    async handleChequeBounce(
        @Req() req: any,
        @Param('id') id: string,
        @Body() dto: HandleChequeBounceDto
    ) {
        return this.paymentsService.handleChequeBounce(
            req.user.organizationId,
            id,
            dto,
            req.user.id
        );
    }
}
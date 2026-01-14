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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';
import {
    CreateInvoiceDto,
    UpdateInvoiceDto,
    InvoiceFiltersDto,
    CancelInvoiceDto,
    GenerateEwayBillDto,
    CreateCreditNoteDto,
    CreateDebitNoteDto
} from './dto';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
    constructor(private readonly invoicesService: InvoicesService) { }

    // ============================================
    // INVOICE CRUD
    // ============================================

    @Post()
    @ApiOperation({ summary: 'Create new invoice (sale/purchase)' })
    @ApiResponse({ status: 201, description: 'Invoice created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input or insufficient stock' })
    async create(@Req() req: any, @Body() dto: CreateInvoiceDto) {
        return this.invoicesService.create(req.user.organizationId, dto, req.user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all invoices with filters and pagination' })
    @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
    async findAll(@Req() req: any, @Query() filters: InvoiceFiltersDto) {
        return this.invoicesService.findAll(req.user.organizationId, filters);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get invoice by ID with items, party, and payment details' })
    @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Invoice not found' })
    async findOne(@Req() req: any, @Param('id') id: string) {
        return this.invoicesService.findById(req.user.organizationId, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update invoice (only if not paid)' })
    @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
    @ApiResponse({ status: 400, description: 'Cannot update paid/cancelled invoice' })
    async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
        return this.invoicesService.update(req.user.organizationId, id, dto);
    }

    @Post(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel invoice (reverses voucher and restores stock)' })
    @ApiResponse({ status: 200, description: 'Invoice cancelled successfully' })
    @ApiResponse({ status: 400, description: 'Cannot cancel paid invoice' })
    async cancel(@Req() req: any, @Param('id') id: string, @Body() dto: CancelInvoiceDto) {
        return this.invoicesService.cancel(req.user.organizationId, id, dto, req.user.id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete invoice (soft delete, only if not paid)' })
    @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
    @ApiResponse({ status: 400, description: 'Cannot delete paid invoice' })
    async remove(@Req() req: any, @Param('id') id: string) {
        return this.invoicesService.remove(req.user.organizationId, id);
    }

    // ============================================
    // CREDIT NOTE (SALES RETURN)
    // ============================================

    @Post('credit-note')
    @ApiOperation({
        summary: 'Create Credit Note (Sales Return)',
        description: 'Creates a credit note to reverse a sale. Supports:\n' +
            '- Partial or full returns\n' +
            '- GST reversal (matches original invoice)\n' +
            '- TCS reversal\n' +
            '- Stock restoration with new batch\n' +
            '- Original invoice balance adjustment'
    })
    @ApiResponse({ status: 201, description: 'Credit note created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid return items or quantities' })
    @ApiResponse({ status: 404, description: 'Original invoice not found' })
    async createCreditNote(@Req() req: any, @Body() dto: CreateCreditNoteDto) {
        return this.invoicesService.createCreditNote(
            req.user.organizationId,
            dto,
            req.user.id
        );
    }

    // ============================================
    // DEBIT NOTE (PURCHASE RETURN)
    // ============================================

    @Post('debit-note')
    @ApiOperation({
        summary: 'Create Debit Note (Purchase Return)',
        description: 'Creates a debit note to return goods to supplier. Supports:\n' +
            '- Partial or full returns\n' +
            '- GST input credit reversal (matches original)\n' +
            '- Stock reduction via FIFO\n' +
            '- Original invoice balance adjustment'
    })
    @ApiResponse({ status: 201, description: 'Debit note created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid return items or insufficient stock' })
    @ApiResponse({ status: 404, description: 'Original invoice not found' })
    async createDebitNote(@Req() req: any, @Body() dto: CreateDebitNoteDto) {
        return this.invoicesService.createDebitNote(
            req.user.organizationId,
            dto,
            req.user.id
        );
    }

    // ============================================
    // E-WAY BILL
    // ============================================

    @Post('eway-bill/generate')
    @ApiOperation({
        summary: 'Generate E-Way Bill from invoice',
        description: 'Generates E-Way Bill for invoices above ₹50,000. Required for interstate goods movement.'
    })
    @ApiResponse({ status: 201, description: 'E-Way Bill generated successfully' })
    @ApiResponse({ status: 400, description: 'Invoice below threshold or invalid transport details' })
    async generateEwayBill(@Req() req: any, @Body() dto: GenerateEwayBillDto) {
        return this.invoicesService.generateEWayBill(
            req.user.organizationId,
            dto,
            req.user.id,
        );
    }

    @Get('eway-bill/:ewayBillNo')
    @ApiOperation({ summary: 'Get E-Way Bill details by number' })
    @ApiResponse({ status: 200, description: 'E-Way Bill details retrieved' })
    @ApiResponse({ status: 404, description: 'E-Way Bill not found' })
    async getEwayBill(@Req() req: any, @Param('ewayBillNo') ewayBillNo: string) {
        return this.invoicesService.getEwayBillDetails(ewayBillNo);
    }
}
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFiltersDto, CreateRecurringExpenseDto } from './dto';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) { }

    @Post()
    @ApiOperation({ summary: 'Record new expense' })
    async create(@Req() req: any, @Body() dto: CreateExpenseDto) {
        return this.expensesService.create(req.user.organizationId, dto, req.user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all expenses' })
    async findAll(@Req() req: any, @Query() filters: ExpenseFiltersDto) {
        return this.expensesService.findAll(req.user.organizationId, filters);
    }

    @Get('summary')
    @ApiOperation({ summary: 'Get expense summary' })
    async getSummary(@Req() req: any, @Query('startDate') startDate: string, @Query('endDate') endDate: string) {
        return this.expensesService.getSummary(req.user.organizationId, new Date(startDate), new Date(endDate));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get expense by ID' })
    async findById(@Req() req: any, @Param('id') id: string) {
        return this.expensesService.findById(req.user.organizationId, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update expense' })
    async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
        return this.expensesService.update(req.user.organizationId, id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete expense' })
    async remove(@Req() req: any, @Param('id') id: string) {
        return this.expensesService.remove(req.user.organizationId, id);
    }

    // Recurring Expenses
    @Post('recurring')
    @ApiOperation({ summary: 'Create recurring expense' })
    async createRecurring(@Req() req: any, @Body() dto: CreateRecurringExpenseDto) {
        return this.expensesService.createRecurring(req.user.organizationId, dto, req.user.id);
    }

    @Get('recurring/list')
    @ApiOperation({ summary: 'Get all recurring expenses' })
    async findAllRecurring(@Req() req: any) {
        return this.expensesService.findAllRecurring(req.user.organizationId);
    }

    @Post('recurring/:id/generate')
    @ApiOperation({ summary: 'Generate next occurrence' })
    async generateNext(@Req() req: any, @Param('id') id: string) {
        return this.expensesService.generateNextOccurrence(req.user.organizationId, id, req.user.id);
    }
}
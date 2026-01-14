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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, ProductFiltersDto, UpdateStockDto } from './dto';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Post()
    @ApiOperation({ summary: 'Create new product' })
    async create(@Req() req: any, @Body() dto: CreateProductDto) {
        return this.productsService.create(dto, req.user.organizationId, req.user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all products with filters' })
    async findAll(@Req() req: any, @Query() filters: ProductFiltersDto) {
        return this.productsService.findAll(req.user.organizationId, filters);
    }

    @Get('search')
    @ApiOperation({ summary: 'Search products by name, code, or barcode' })
    @ApiQuery({ name: 'q', required: true })
    async search(@Req() req: any, @Query('q') query: string) {
        return this.productsService.search(req.user.organizationId, query);
    }

    @Get('categories')
    @ApiOperation({ summary: 'Get all product categories' })
    async getCategories(@Req() req: any) {
        return this.productsService.getCategories(req.user.organizationId);
    }

    @Get('low-stock')
    @ApiOperation({ summary: 'Get low stock products with shortage details' })
    async getLowStock(@Req() req: any) {
        return this.productsService.getLowStockProducts(req.user.organizationId);
    }

    @Get('barcode/:barcode')
    @ApiOperation({ summary: 'Get product by barcode' })
    async findByBarcode(@Req() req: any, @Param('barcode') barcode: string) {
        return this.productsService.findByBarcode(req.user.organizationId, barcode);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get product by ID with batch details' })
    async findOne(@Req() req: any, @Param('id') id: string) {
        return this.productsService.findById(req.user.organizationId, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update product' })
    async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProductDto) {
        return this.productsService.update(req.user.organizationId, id, dto);
    }

    @Put(':id/stock')
    @ApiOperation({ summary: 'Update product stock manually' })
    async updateStock(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateStockDto) {
        return this.productsService.updateStock(req.user.organizationId, id, dto, req.user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete product (with validation)' })
    async remove(@Req() req: any, @Param('id') id: string) {
        return this.productsService.remove(req.user.organizationId, id);
    }
}

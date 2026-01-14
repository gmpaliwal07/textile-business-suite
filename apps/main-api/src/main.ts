import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";


async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api/v1');
    app.enableCors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
        methods: 'GET,POST,PUT,DELETE',
    });

    app.use(cookieParser())
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    const config = new DocumentBuilder()
        .setTitle('Textile Business Management API')
        .setDescription('Complete API for textile business operations')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('Auth', 'Authentication & Authorization')
        .addTag('Organizations', 'Organization management')
        .addTag('Users', 'User management')
        .addTag('Parties', 'Customer & Supplier management')
        .addTag('Products', 'Product & Catalog management')
        .addTag('Invoices', 'Invoice management')
        .addTag('Payments', 'Payment management')
        .addTag('Reports', 'Reports & Analytics')
        .addTag('Sync', 'Offline sync operations')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3004;
    await app.listen(port);

    console.log(`🚀 Main API running on http://localhost:${port}`);
    console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();

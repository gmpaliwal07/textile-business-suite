import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: 'GET,POST,PUT,DELETE',
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('OTP Microservice')
    .setDescription('Multi-channel OTP service for authentication')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const docs = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, docs);

  const port = process.env.PORT || 3001;

  await app.listen(port);

  console.log(`🚀 OTP Service running on http://localhost:${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
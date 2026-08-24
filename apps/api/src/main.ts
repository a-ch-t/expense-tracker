import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: ['http://localhost:3000'], credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  // setGlobalPrefix не действует на сам Swagger UI — префикс 'api' указан явно в пути.
  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Expense Tracker API').setVersion('1.0').build(),
  );
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port);

  Logger.log(`API слушает http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();

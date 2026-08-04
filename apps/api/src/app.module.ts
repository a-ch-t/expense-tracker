import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env лежит в корне монорепозитория, а не в apps/api
      envFilePath: ['../../.env'],
    }),
    PrismaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../common/auth';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

// Единственный владелец таблицы Category. Наружу ничего не экспортирует —
// для других модулей позже появятся контракты CQRS.
@Module({
  imports: [AuthCoreModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}

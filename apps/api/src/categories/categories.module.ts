import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../common/auth';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import { GetCategoriesByUserHandler } from './handlers/get-categories-by-user.handler';
import { GetCategoryByIdHandler } from './handlers/get-category-by-id.handler';

const handlers = [GetCategoriesByUserHandler, GetCategoryByIdHandler];

// Единственный владелец таблицы Category. Наружу ничего не экспортирует —
// другие модули читают категории только через QueryBus и contracts/categories.
@Module({
  imports: [AuthCoreModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository, ...handlers],
})
export class CategoriesModule {}

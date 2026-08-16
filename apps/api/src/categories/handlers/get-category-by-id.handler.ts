import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetCategoryByIdQuery, type CategoryReadModel } from '../../contracts/categories';
import { CategoriesRepository } from '../categories.repository';

@QueryHandler(GetCategoryByIdQuery)
export class GetCategoryByIdHandler implements IQueryHandler<
  GetCategoryByIdQuery,
  CategoryReadModel | null
> {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  execute(query: GetCategoryByIdQuery): Promise<CategoryReadModel | null> {
    return this.categoriesRepository.findByIdForUser(query.id, query.userId);
  }
}

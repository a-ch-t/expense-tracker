import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetCategoriesByUserQuery, type CategoryReadModel } from '../../contracts/categories';
import { CategoriesRepository } from '../categories.repository';

@QueryHandler(GetCategoriesByUserQuery)
export class GetCategoriesByUserHandler implements IQueryHandler<
  GetCategoriesByUserQuery,
  CategoryReadModel[]
> {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  execute(query: GetCategoriesByUserQuery): Promise<CategoryReadModel[]> {
    return this.categoriesRepository.findAllByUser(query.userId);
  }
}

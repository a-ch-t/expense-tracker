import { Query } from '@nestjs/cqrs';
import type { CategoryReadModel } from './category.read-model';

/**
 * Ищет категорию пользователя. userId — часть условия: чужая категория
 * неотличима от несуществующей и возвращается как null.
 */
export class GetCategoryByIdQuery extends Query<CategoryReadModel | null> {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {
    super();
  }
}

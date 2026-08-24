import { Query } from '@nestjs/cqrs';
import type { CategoryReadModel } from './category.read-model';

/**
 * Ищет категорию пользователя. userId — часть условия: чужая категория
 * неотличима от несуществующей и возвращается как null.
 */
export class GetCategoryByIdQuery extends Query<CategoryReadModel | null> {
  /**
   * @param id - идентификатор категории.
   * @param userId - id пользователя, которому категория должна принадлежать.
   */
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {
    super();
  }
}

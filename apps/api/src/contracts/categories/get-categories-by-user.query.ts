import { Query } from '@nestjs/cqrs';
import type { CategoryReadModel } from './category.read-model';

/** Все категории пользователя — чтобы подставить их в список транзакций одним запросом. */
export class GetCategoriesByUserQuery extends Query<CategoryReadModel[]> {
  /**
   * @param userId - id пользователя, чьи категории нужно получить.
   */
  constructor(public readonly userId: string) {
    super();
  }
}

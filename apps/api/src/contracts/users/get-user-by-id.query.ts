import { Query } from '@nestjs/cqrs';
import type { UserReadModel } from './user.read-model';

export class GetUserByIdQuery extends Query<UserReadModel | null> {
  constructor(public readonly id: string) {
    super();
  }
}

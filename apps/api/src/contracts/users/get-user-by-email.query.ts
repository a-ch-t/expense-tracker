import { Query } from '@nestjs/cqrs';
import type { UserCredentials } from './user.read-model';

/** Ищет пользователя вместе с хэшем пароля — используется только при логине. */
export class GetUserByEmailQuery extends Query<UserCredentials | null> {
  constructor(public readonly email: string) {
    super();
  }
}

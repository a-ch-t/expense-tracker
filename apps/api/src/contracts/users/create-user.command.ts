import { Command } from '@nestjs/cqrs';
import type { UserReadModel } from './user.read-model';

/** Создаёт пользователя. Пароль приходит уже захэшированным — auth хэширует до отправки. */
export class CreateUserCommand extends Command<UserReadModel> {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly passwordHash: string,
  ) {
    super();
  }
}

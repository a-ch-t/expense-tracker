import { Module } from '@nestjs/common';
import { CreateUserHandler } from './handlers/create-user.handler';
import { GetUserByEmailHandler } from './handlers/get-user-by-email.handler';
import { GetUserByIdHandler } from './handlers/get-user-by-id.handler';
import { UsersRepository } from './users.repository';

const handlers = [CreateUserHandler, GetUserByEmailHandler, GetUserByIdHandler];

// Ничего не экспортирует: снаружи модуль доступен только через CommandBus/QueryBus.
@Module({
  providers: [UsersRepository, ...handlers],
})
export class UsersModule {}

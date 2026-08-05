import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetUserByIdQuery, type UserReadModel } from '../../contracts/users';
import { UsersRepository } from '../users.repository';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, UserReadModel | null> {
  constructor(private readonly usersRepository: UsersRepository) {}

  execute(query: GetUserByIdQuery): Promise<UserReadModel | null> {
    return this.usersRepository.findById(query.id);
  }
}

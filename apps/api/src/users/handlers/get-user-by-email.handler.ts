import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetUserByEmailQuery, type UserCredentials } from '../../contracts/users';
import { UsersRepository } from '../users.repository';

@QueryHandler(GetUserByEmailQuery)
export class GetUserByEmailHandler
  implements IQueryHandler<GetUserByEmailQuery, UserCredentials | null>
{
  constructor(private readonly usersRepository: UsersRepository) {}

  execute(query: GetUserByEmailQuery): Promise<UserCredentials | null> {
    return this.usersRepository.findByEmail(query.email);
  }
}

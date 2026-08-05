import { ConflictException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@expense-tracker/db';
import { CreateUserCommand, type UserReadModel } from '../../contracts/users';
import { UsersRepository } from '../users.repository';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, UserReadModel> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(command: CreateUserCommand): Promise<UserReadModel> {
    const email = command.email.trim().toLowerCase();

    try {
      return await this.usersRepository.create(command.name, email, command.passwordHash);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Пользователь с таким email уже существует');
      }
      throw error;
    }
  }
}

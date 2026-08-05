import { Injectable } from '@nestjs/common';
import type { User } from '@expense-tracker/db';
import { PrismaService } from '../prisma/prisma.service';
import type { UserCredentials, UserReadModel } from '../contracts/users';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, email: string, passwordHash: string): Promise<UserReadModel> {
    const user = await this.prisma.user.create({ data: { name, email, passwordHash } });
    return this.toReadModel(user);
  }

  async findByEmail(email: string): Promise<UserCredentials | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? { ...this.toReadModel(user), passwordHash: user.passwordHash } : null;
  }

  async findById(id: string): Promise<UserReadModel | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toReadModel(user) : null;
  }

  private toReadModel(user: User): UserReadModel {
    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  }
}

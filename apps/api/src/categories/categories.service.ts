import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Prisma } from '@expense-tracker/db';
import type { CategoryReadModel } from '../contracts/categories';
import { GetUserByIdQuery, type UserReadModel } from '../contracts/users';
import { CategoriesRepository } from './categories.repository';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

/** Коды Prisma, которые превращаем в осмысленные HTTP-ошибки. */
const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';
const FOREIGN_KEY_VIOLATION = 'P2003';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly queryBus: QueryBus,
  ) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryReadModel> {
    // Проверяем владельца через CQRS: users — единственный, кто читает таблицу User
    const owner = await this.queryBus.execute<GetUserByIdQuery, UserReadModel | null>(
      new GetUserByIdQuery(userId),
    );

    if (!owner) {
      // Токен ещё валиден, но пользователя удалили — как в GET /api/auth/me
      throw new UnauthorizedException('Пользователь не найден');
    }

    try {
      return await this.categoriesRepository.create(userId, {
        name: dto.name.trim(),
        color: dto.color.toLowerCase(),
        icon: dto.icon,
      });
    } catch (error) {
      throw this.mapPrismaError(error, dto.name.trim());
    }
  }

  findAll(userId: string): Promise<CategoryReadModel[]> {
    return this.categoriesRepository.findAllByUser(userId);
  }

  async findOne(userId: string, id: string): Promise<CategoryReadModel> {
    const category = await this.categoriesRepository.findByIdForUser(id, userId);

    if (!category) {
      // Чужая категория неотличима от несуществующей: 404, а не 403,
      // чтобы не подтверждать существование чужих ресурсов.
      throw new NotFoundException('Категория не найдена');
    }

    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryReadModel> {
    const data = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.color !== undefined && { color: dto.color.toLowerCase() }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
    };

    try {
      return await this.categoriesRepository.update(id, userId, data);
    } catch (error) {
      throw this.mapPrismaError(error, dto.name?.trim());
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.categoriesRepository.remove(id, userId);
    } catch (error) {
      if (isPrismaError(error, FOREIGN_KEY_VIOLATION)) {
        // Здесь P2003 значит не «нет пользователя», а Restrict со стороны Transaction
        throw new ConflictException('Нельзя удалить категорию, пока в ней есть транзакции');
      }
      throw this.mapPrismaError(error);
    }
  }

  private mapPrismaError(error: unknown, name?: string): unknown {
    if (isPrismaError(error, UNIQUE_VIOLATION)) {
      return new ConflictException(`Категория «${name ?? ''}» уже существует`);
    }
    if (isPrismaError(error, RECORD_NOT_FOUND)) {
      // update/delete не нашли строку по паре (id, userId)
      return new NotFoundException('Категория не найдена');
    }
    if (isPrismaError(error, FOREIGN_KEY_VIOLATION)) {
      // Пользователя удалили между проверкой и вставкой
      return new UnauthorizedException('Пользователь не найден');
    }
    return error;
  }
}

import { Injectable } from '@nestjs/common';
import type { Category, Prisma } from '@expense-tracker/db';
import { PrismaService } from '../prisma/prisma.service';
import type { CategoryReadModel } from './category.read-model';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    data: Omit<CategoryReadModel, 'id' | 'createdAt'>,
  ): Promise<CategoryReadModel> {
    const category = await this.prisma.category.create({ data: { ...data, userId } });
    return this.toReadModel(category);
  }

  async findAllByUser(userId: string): Promise<CategoryReadModel[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return categories.map((category) => this.toReadModel(category));
  }

  async findByIdForUser(id: string, userId: string): Promise<CategoryReadModel | null> {
    // findFirst, а не findUnique: userId — часть условия владения, а не уникальный ключ
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    return category ? this.toReadModel(category) : null;
  }

  async update(
    id: string,
    userId: string,
    data: Prisma.CategoryUpdateInput,
  ): Promise<CategoryReadModel> {
    // userId прямо в where: чужую категорию Prisma не найдёт и бросит P2025
    const category = await this.prisma.category.update({ where: { id, userId }, data });
    return this.toReadModel(category);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.prisma.category.delete({ where: { id, userId } });
  }

  private toReadModel(category: Category): CategoryReadModel {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt,
    };
  }
}

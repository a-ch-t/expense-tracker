import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, type JwtPayload } from '../common/auth';
import { CategoriesService } from './categories.service';
import type { CategoryReadModel } from './category.read-model';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// Гард на весь контроллер: без валидного токена ни один эндпоинт недоступен.
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryReadModel> {
    return this.categoriesService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<CategoryReadModel[]> {
    return this.categoriesService.findAll(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<CategoryReadModel> {
    return this.categoriesService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryReadModel> {
    return this.categoriesService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    return this.categoriesService.remove(user.sub, id);
  }
}

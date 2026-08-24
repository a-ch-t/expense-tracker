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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, type JwtPayload } from '../common/auth';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import type { TransactionReadModel, TransactionsPage } from './transaction.read-model';
import { TransactionsService } from './transactions.service';

/**
 * REST-контроллер CRUD для транзакций текущего пользователя.
 * Гард на весь контроллер: без валидного токена ни один эндпоинт недоступен.
 */
@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Создаёт транзакцию для текущего пользователя.
   * @param user - данные пользователя из JWT-токена, подставляет декоратор `CurrentUser`.
   * @param dto - данные новой транзакции.
   * @returns созданная транзакция с подставленной категорией.
   * @throws {NotFoundException} если категория не найдена или принадлежит другому пользователю.
   */
  @ApiOperation({ summary: 'Создать транзакцию' })
  @ApiResponse({ status: 201, description: 'Транзакция создана' })
  @ApiResponse({ status: 400, description: 'Данные не прошли валидацию' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionReadModel> {
    return this.transactionsService.create(user.sub, dto);
  }

  /**
   * Возвращает страницу транзакций текущего пользователя вместе с агрегатами за весь период.
   * @param user - данные пользователя из JWT-токена.
   * @param query - фильтр периода (`year`/`month`) и параметры пагинации.
   * @returns элементы текущей страницы, сводку `{ income, expense, balance }` за весь период
   * и данные пагинации.
   * @throws {BadRequestException} если указан `month` без `year`.
   */
  @ApiOperation({ summary: 'Получить список транзакций текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Страница транзакций с агрегатами и пагинацией' })
  @ApiResponse({ status: 400, description: 'month указан без year' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryTransactionsDto,
  ): Promise<TransactionsPage> {
    return this.transactionsService.findAll(user.sub, query);
  }

  /**
   * Возвращает одну транзакцию текущего пользователя по идентификатору.
   * @param user - данные пользователя из JWT-токена.
   * @param id - идентификатор транзакции (UUID v7).
   * @returns транзакция с подставленной категорией.
   * @throws {NotFoundException} если транзакция не найдена или принадлежит другому пользователю.
   */
  @ApiOperation({ summary: 'Получить транзакцию по id' })
  @ApiResponse({ status: 200, description: 'Транзакция найдена' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiResponse({ status: 404, description: 'Транзакция не найдена' })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<TransactionReadModel> {
    return this.transactionsService.findOne(user.sub, id);
  }

  /**
   * Частично обновляет транзакцию текущего пользователя.
   * @param user - данные пользователя из JWT-токена.
   * @param id - идентификатор транзакции (UUID v7).
   * @param dto - поля для обновления; отсутствующие в теле запроса поля не изменяются.
   * @returns обновлённая транзакция с подставленной категорией.
   * @throws {NotFoundException} если транзакция или указанная в `dto.categoryId` категория
   * не найдены.
   */
  @ApiOperation({ summary: 'Частично обновить транзакцию' })
  @ApiResponse({ status: 200, description: 'Транзакция обновлена' })
  @ApiResponse({ status: 400, description: 'Данные не прошли валидацию' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiResponse({ status: 404, description: 'Транзакция или категория не найдены' })
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionReadModel> {
    return this.transactionsService.update(user.sub, id, dto);
  }

  /**
   * Удаляет транзакцию текущего пользователя.
   * @param user - данные пользователя из JWT-токена.
   * @param id - идентификатор транзакции (UUID v7).
   * @returns ничего; при успехе отвечает `204 No Content`.
   * @throws {NotFoundException} если транзакция не найдена или принадлежит другому пользователю.
   */
  @ApiOperation({ summary: 'Удалить транзакцию' })
  @ApiResponse({ status: 204, description: 'Транзакция удалена' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiResponse({ status: 404, description: 'Транзакция не найдена' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    return this.transactionsService.remove(user.sub, id);
  }
}

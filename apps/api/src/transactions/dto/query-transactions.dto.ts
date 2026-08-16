import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Первая страница по десять записей — столько показывает главный экран. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
/** Верхняя граница limit: страница крупнее не имеет смысла и грузит БД. */
export const MAX_LIMIT = 100;
/**
 * Верхняя граница page. Без неё skip = (page - 1) * limit перешагивает INT32,
 * который Prisma принимает для skip, и вместо 400 клиент получает 500.
 */
export const MAX_PAGE = 1_000_000;

/**
 * Фильтр периода и страница выдачи. Без параметров возвращается первая страница
 * из десяти записей по всем транзакциям пользователя.
 * @Type обязателен: query-параметры приходят строками, а enableImplicitConversion
 * в глобальном ValidationPipe не включён.
 */
export class QueryTransactionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  // Без year не имеет смысла — проверяется в сервисе
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  // Значение по умолчанию — инициализатором поля: ValidationPipe создаёт экземпляр
  // класса, поэтому отсутствующий в query параметр остаётся тем, что здесь записано.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}

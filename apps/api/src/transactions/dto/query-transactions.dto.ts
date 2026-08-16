import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Фильтр периода. Без параметров возвращаются все транзакции пользователя.
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
}

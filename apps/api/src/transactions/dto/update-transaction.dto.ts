import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TransactionType } from '@expense-tracker/db';
import { MAX_AMOUNT } from './create-transaction.dto';

/**
 * Тело запроса `PATCH /transactions/:id`: поля для частичного обновления транзакции.
 * `PartialType` не используем: `@nestjs/mapped-types` нет в зависимостях.
 */
export class UpdateTransactionDto {
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount должен быть числом не более чем с 2 знаками после запятой' },
  )
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount?: number;

  @IsOptional()
  @IsEnum(TransactionType, { message: 'type должен быть income или expense' })
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'date должна быть датой в формате ISO 8601' })
  date?: Date;

  @IsOptional()
  @IsUUID('7')
  categoryId?: string;
}

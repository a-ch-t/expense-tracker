import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TransactionType } from '@expense-tracker/db';

/** Потолок Decimal(12, 2) в схеме: 10 цифр до запятой и 2 после. */
export const MAX_AMOUNT = 9_999_999_999.99;

export class CreateTransactionDto {
  // Сумма всегда положительная — доход это или расход, говорит type
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount должен быть числом не более чем с 2 знаками после запятой' },
  )
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount!: number;

  @IsEnum(TransactionType, { message: 'type должен быть income или expense' })
  type!: TransactionType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  // Type превращает ISO-строку в Date, IsDate отсекает Invalid Date
  @Type(() => Date)
  @IsDate({ message: 'date должна быть датой в формате ISO 8601' })
  date!: Date;

  @IsUUID('7')
  categoryId!: string;
}

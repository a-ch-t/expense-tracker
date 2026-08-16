import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../common/auth';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

// Единственный владелец таблицы Transaction. Категории и пользователя читает
// только через QueryBus — прямых импортов чужих модулей здесь нет.
@Module({
  imports: [AuthCoreModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository],
})
export class TransactionsModule {}

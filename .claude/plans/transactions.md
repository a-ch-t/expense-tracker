# План: модуль transactions (API)

## Контекст

В проекте уже есть авторизация (JWT) и модуль категорий, но нет самого предмета учёта — доходов
и расходов. Без него категории ни к чему не привязаны, а дашборд остаётся заглушкой
(`apps/web/src/views/dashboard/ui/dashboard-page.tsx` показывает только имя пользователя).

Задача (`.claude/prompts/transactions.md`) — центральный модуль учёта: CRUD транзакций плюс
выборка за период с агрегированной сводкой доходов/расходов/баланса. Только backend; фронтенд
остаётся без изменений и подключится отдельной задачей.

**Важно:** промпт ссылается на `src/modules/categories/` — такого каталога нет. Модули лежат
плоско: `apps/api/src/categories/`. Новый модуль → `apps/api/src/transactions/`.

### Принятые решения

| Вопрос              | Решение                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `GET /transactions` | `{ items, summary: { income, expense, balance } }`, фильтр `?year&month` |
| `amount`            | БД `Decimal @db.Decimal(12, 2)`, наружу `number`                         |
| `categoryId`        | Обязателен, FK `onDelete: Restrict`                                      |
| Объём               | Только `apps/api` + `packages/db`                                        |

Допущение: `description` — обязательное поле (1–200 символов), как `name` у категории.

### Архитектурное следствие

Транзакции должны отдавать вложенную категорию и проверять, что `categoryId` принадлежит
пользователю. Но `Category` — таблица модуля `categories`, а прямые импорты между фича-модулями
запрещены ESLint-ом (`apps/api/eslint.config.mjs`). Значит, по образцу `contracts/users/`
появляется **`apps/api/src/contracts/categories/`**, а `categories` обзаводится папкой
`handlers/` — ровно так, как это сделано в `users`.

---

## Чек-лист

**Статус: выполнено полностью** (2026-08-15).

- [x] **Шаг 1.** Схема БД и миграция (`schema.prisma`, `db:generate`, `db:migrate`)
- [x] **Шаг 2.** Слой контрактов `contracts/categories/` + хендлеры в `categories`
  - [x] 2.1 Создать `contracts/categories/` и перенести туда `CategoryReadModel`
  - [x] 2.2 Хендлеры `categories/handlers/` и их регистрация в модуле
  - [x] 2.3 Правка `CategoriesService.remove`: `P2003` → 409
- [x] **Шаг 3.** Модуль `apps/api/src/transactions/`
  - [x] 3.1 `transaction.read-model.ts`
  - [x] 3.2 DTO (`create` / `update` / `query`)
  - [x] 3.3 `transactions.repository.ts`
  - [x] 3.4 `transactions.service.ts`
- [x] **Шаг 4.** Контроллер и эндпоинты
- [x] **Шаг 5.** Регистрация модуля в `AppModule` и правка ESLint
- [x] **Шаг 6.** Тесты (`transactions.service.spec.ts` + дополнение спеки категорий)
- [x] **Шаг 7.** Документация (`CLAUDE.md`, `README.md`)
- [x] **Шаг 8.** Верификация: `lint`, `typecheck`, `test`, `build` + ручные curl-проверки

### Что разошлось с планом

Разделы ниже описывают замысел; здесь — то, чем реализация от него отличается.

- **Шаг 1 неполон: `db:generate` не хватает.** `exports` пакета `@expense-tracker/db` указывает
  на `dist/`, а `prisma generate` пишет в `src/generated/`. Пока не отработал `tsc`, API видит
  старый набор типов и падает с `TS2305: has no exported member 'TransactionType'`. Нужен
  `npm run build -w @expense-tracker/db`. Записано в `CLAUDE.md` отдельным абзацем.
- **`npm run db:migrate -- --name X` не работает**: `--name` перехватывает npm, и Prisma уходит
  в интерактивный запрос имени. Миграция создана напрямую:
  `cd packages/db && npx prisma migrate dev --name add_transaction` →
  `20260815180515_add_transaction`.
- **Шаг 3.1**: добавлен не предусмотренный планом `TransactionsPeriod` — тип границ периода,
  общий для сервиса и репозитория.
- **Шаг 3.3**: `orderBy` не `{ date: 'desc' }`, а `[{ date: 'desc' }, { createdAt: 'desc' }]` —
  иначе транзакции с одинаковой датой шли в непредсказуемом порядке.
- **Шаг 3.4**: сервис ещё и обрезает `description` (`trim()`), по образцу `name` у категорий.
- **Шаг 6**: 37 тестов в 2 сюитах, включая проверку декабрьской границы периода
  (переход на январь следующего года).

### Результат верификации

`lint`, `typecheck` (три workspace), `build` (включая Next) — зелёные; тесты 37/37.
Ручные curl-проверки подтвердили сводку (`income: 90000, expense: 1500.5, balance: 88499.5`),
400 на `month` без `year`, 409 на удаление занятой категории, 404 на чужие транзакции и
категории, 400 на `amount: -5` / `1.234` / `type: refund` / лишний `userId` / кривую дату,
401 без токена, 204 на `DELETE` и 404 на повторный.

**Не входило в объём:** фронтенд. Когда дойдёт до UI, `apiFetch`
(`apps/web/src/shared/api/api-client.ts`) придётся расширить: он умеет только `GET`/`POST`
и бросает ошибку на ответ без тела, то есть на 204 от `DELETE`.

---

## Шаг 1. Схема БД и миграция

`packages/db/prisma/schema.prisma`:

```prisma
enum TransactionType {
  income
  expense
}

/// Доход или расход пользователя. Всегда привязан к категории.
model Transaction {
  id          String          @id @default(uuid(7))
  /// Всегда положительная сумма; знак определяется полем type
  amount      Decimal         @db.Decimal(12, 2)
  type        TransactionType
  description String
  /// Дата операции (не путать с createdAt — временем внесения в систему)
  date        DateTime
  categoryId  String
  category    Category        @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  // Покрывает и выборку всех транзакций пользователя, и фильтр по периоду
  @@index([userId, date])
}
```

Плюс обратные связи: `transactions Transaction[]` в `User` и в `Category`.

`onDelete: Restrict` у категории — намеренно: удаление категории не должно уносить историю трат.
Prisma вернёт `P2003`, который мы превратим в 409 (шаг 2.3).

Затем `npm run db:generate` и `npm run db:migrate` (имя миграции — `add_transaction`, по образцу
`20260808193224_add_category`). Без генерации `typecheck`/`build` упадут — `src/generated/`
не в git.

## Шаг 2. Контракты категорий

### 2.1 Новый слой `apps/api/src/contracts/categories/`

Повторяет устройство `apps/api/src/contracts/users/`:

- `category.read-model.ts` — **переезд** существующего `apps/api/src/categories/category.read-model.ts`
  (интерфейс `CategoryReadModel` без изменений). Старый файл удаляется, импорты в
  `categories.controller.ts`, `categories.service.ts`, `categories.repository.ts` и
  `categories.service.spec.ts` меняются на `'../contracts/categories'`.
- `get-category-by-id.query.ts` — `GetCategoryByIdQuery extends Query<CategoryReadModel | null>`
  с полями `id` и `userId` (владение проверяется внутри запроса, как в `findByIdForUser`).
- `get-categories-by-user.query.ts` — `GetCategoriesByUserQuery extends Query<CategoryReadModel[]>`
  с полем `userId`; нужен, чтобы обогатить список транзакций категориями одним запросом.
- `index.ts` — барель, экспортирует оба запроса и тип read-модели.

### 2.2 Хендлеры в `apps/api/src/categories/handlers/`

По образцу `apps/api/src/users/handlers/`: `get-category-by-id.handler.ts` и
`get-categories-by-user.handler.ts` проксируют существующие
`CategoriesRepository.findByIdForUser(id, userId)` и `findAllByUser(userId)` — новых методов
репозитория не требуется. Регистрируются в `categories.module.ts` через локальный
`const handlers = [...]`, `exports` остаётся пустым.

### 2.3 Правка `CategoriesService.remove`

Сейчас `mapPrismaError` переводит `P2003` в `UnauthorizedException('Пользователь не найден')`.
С появлением `Restrict` тот же код начнёт приходить при попытке удалить категорию с
транзакциями. В `remove` обработать `P2003` до вызова `mapPrismaError`:

```ts
if (isPrismaError(error, FOREIGN_KEY_VIOLATION)) {
  throw new ConflictException('Нельзя удалить категорию, пока в ней есть транзакции');
}
```

## Шаг 3. Модуль `apps/api/src/transactions/`

Структура — калька с `categories` (контроллер → сервис → репозиторий, без внутреннего CQRS):

```
apps/api/src/transactions/
├── transactions.module.ts
├── transactions.controller.ts
├── transactions.service.ts
├── transactions.service.spec.ts
├── transactions.repository.ts
├── transaction.read-model.ts
└── dto/
    ├── create-transaction.dto.ts
    ├── update-transaction.dto.ts
    └── query-transactions.dto.ts
```

### 3.1 `transaction.read-model.ts`

```ts
/** Строка из БД: категория ещё не подставлена. */
export interface TransactionRecord {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: Date;
  categoryId: string;
  createdAt: Date;
}

/** Публичное представление: categoryId заменён на саму категорию. */
export interface TransactionReadModel extends Omit<TransactionRecord, 'categoryId'> {
  category: CategoryReadModel;
}

export interface TransactionsSummary {
  income: number;
  expense: number;
  balance: number;
}

export interface TransactionsPage {
  items: TransactionReadModel[];
  summary: TransactionsSummary;
}
```

### 3.2 DTO (`class-validator`, новых зависимостей нет)

`create-transaction.dto.ts`:

- `amount`: `@IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(9_999_999_999.99)`
- `type`: `@IsEnum(TransactionType)` (enum из `@expense-tracker/db`)
- `description`: `@IsString() @MinLength(1) @MaxLength(200)`
- `date`: `@Type(() => Date) @IsDate()`
- `categoryId`: `@IsUUID('7')`

`update-transaction.dto.ts` — те же поля, каждое с `@IsOptional()` первым декоратором и `?`.
`PartialType` не применяем: `@nestjs/mapped-types` нет в зависимостях (так же поступили в
`update-category.dto.ts`).

`query-transactions.dto.ts`:

- `year?`: `@IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)`
- `month?`: `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)`

`@Type` обязателен — query-параметры приходят строками, а `enableImplicitConversion`
в `ValidationPipe` не включён.

### 3.3 `transactions.repository.ts`

Инжектит `PrismaService`, приватный `toRecord(transaction)` отсекает `userId`/`updatedAt` и
делает `amount.toNumber()`. Методы по образцу `CategoriesRepository`:

- `create(userId, data)` — `prisma.transaction.create`
- `findAllByUser(userId, period?)` — `findMany({ where, orderBy: { date: 'desc' } })`
- `findByIdForUser(id, userId)` — `findFirst` (userId — условие владения, не уникальный ключ)
- `update(id, userId, data)` / `remove(id, userId)` — `userId` прямо в `where`, чужая строка даёт `P2025`
- `summarize(userId, period?)` — `groupBy({ by: ['type'], where, _sum: { amount } })`; из двух
  строк собирается `TransactionsSummary` (`_sum.amount` может быть `null` → `0`,
  `balance = income - expense`)

`period` — интервал `{ gte, lt }`, считается в сервисе.

### 3.4 `transactions.service.ts`

Инжектит `TransactionsRepository` и `QueryBus`. Логика:

- **create**: `GetUserByIdQuery` (владелец, как в `CategoriesService.create`) → `GetCategoryByIdQuery`;
  нет категории → `NotFoundException('Категория не найдена')`. Затем вставка и обогащение
  полученной категорией.
- **findAll(userId, query)**: `month` без `year` → `BadRequestException`. Границы периода — UTC-полуинтервал
  `[Date.UTC(year, month - 1, 1), Date.UTC(year, month, 1))`, для года без месяца —
  `[Date.UTC(year, 0, 1), Date.UTC(year + 1, 0, 1))`. Параллельно `findAllByUser` + `summarize`,
  категории тянутся одним `GetCategoriesByUserQuery` и склеиваются через `Map`.
- **findOne**: `null` → 404 (чужая транзакция неотличима от несуществующей — как в категориях).
- **update**: частичный объект через `...(dto.x !== undefined && { x })`; если приходит
  `categoryId` — предварительная проверка `GetCategoryByIdQuery`.
- **remove**: `P2025` → 404.
- Приватный `mapPrismaError`, возвращающий (не бросающий) исключение: `P2025` → `NotFoundException`,
  `P2003` → `NotFoundException('Категория не найдена')` — гонка, когда категорию удалили между
  проверкой и вставкой.

## Шаг 4. Контроллер

`@Controller('transactions')` + `@UseGuards(JwtAuthGuard)` на весь класс. Методы не `async` —
возвращают промис сервиса, первым аргументом всегда `user.sub`:

| Метод     | Маршрут                            | Ответ                  |
| --------- | ---------------------------------- | ---------------------- |
| `create`  | `POST /api/transactions`           | `TransactionReadModel` |
| `findAll` | `GET /api/transactions?year&month` | `TransactionsPage`     |
| `findOne` | `GET /api/transactions/:id`        | `TransactionReadModel` |
| `update`  | `PATCH /api/transactions/:id`      | `TransactionReadModel` |
| `remove`  | `DELETE /api/transactions/:id`     | 204, `void`            |

`:id` — через `new ParseUUIDPipe({ version: '7' })`, как в `categories.controller.ts:42`.
Query-DTO принимается через `@Query() query: QueryTransactionsDto`.

## Шаг 5. Регистрация и ESLint

- `transactions.module.ts`: `imports: [AuthCoreModule]` (`PrismaModule` глобальный, `CqrsModule`
  подключён в `AppModule`), `controllers` + `providers`, пустой `exports`.
- `apps/api/src/app.module.ts`: `TransactionsModule` в конец списка `imports`.
- `apps/api/eslint.config.mjs`: новый блок для `src/transactions/**/*.ts` с паттернами
  `['**/users/**', '**/auth/**', '**/categories/**']`, и `'**/transactions/**'` добавляется
  в паттерны трёх существующих блоков. Паттерн матчит сырую строку импорта, поэтому
  `'../contracts/categories'` проходит, а `'../contracts/categories/category.read-model'` — нет.

## Шаг 6. Тесты

`apps/api/src/transactions/transactions.service.spec.ts` по образцу
`apps/api/src/categories/categories.service.spec.ts`: `Test.createTestingModule` с
`{ provide: TransactionsRepository, useValue: <моки jest.fn()> }` и
`{ provide: QueryBus, useValue: { execute: jest.fn() } }`, фабрика `prismaError(code)`. БД
не поднимается. `describe` на метод, названия `it` — на русском.

Покрыть: отсутствие владельца → 401; чужая/несуществующая категория → 404; успешное создание
с подстановкой категории; `month` без `year` → 400; границы UTC-периода в аргументах репозитория;
сборку `summary` (включая `_sum.amount === null` → 0 и расчёт `balance`); частичный `update`;
`P2025` → 404 в `update`/`remove`; неизвестная ошибка пробрасывается как есть.

Дополнить `apps/api/src/categories/categories.service.spec.ts`: `P2003` в `remove` → 409.

## Шаг 7. Документация

- `CLAUDE.md`: в «Состояние проекта» — модель `Transaction` и эндпоинты; в «Архитектуру» —
  что `contracts/categories/` появился по той же причине, что и `contracts/users/`, и что
  `CategoryReadModel` теперь живёт в контрактах.
- `README.md`: раздел «Модель данных» / список эндпоинтов.

## Шаг 8. Верификация

```bash
npm run db:generate && npm run db:migrate
npm run lint && npm run typecheck
npm test -w @expense-tracker/api
npm run build            # явное требование ТЗ
```

Ручная проверка (в отдельном терминале `npm run db:up`, затем `npm run dev:api`);
`TOKEN` берётся из `POST /api/auth/login`, `CAT` — из `POST /api/categories`:

```bash
# создание
curl -X POST localhost:3001/api/transactions -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"amount\":1500.5,\"type\":\"expense\",\"description\":\"Продукты\",\"date\":\"2026-08-14\",\"categoryId\":\"$CAT\"}"

curl "localhost:3001/api/transactions?year=2026&month=8" -H "Authorization: Bearer $TOKEN"   # items + summary
curl "localhost:3001/api/transactions?month=8"           -H "Authorization: Bearer $TOKEN"   # → 400
curl -X DELETE "localhost:3001/api/categories/$CAT"      -H "Authorization: Bearer $TOKEN"   # → 409, категория занята
curl -X POST localhost:3001/api/transactions -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"amount":-5,...}'                                 # → 400
curl localhost:3001/api/transactions                                                          # → 401 без токена
```

Отдельно проверить, что чужая транзакция даёт 404, а не 403 (второй пользователь, тот же `:id`).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in
`apps/api`. Общее по монорепозиторию (команды, ветки, коммиты, конвенции TypeScript/ESLint) —
в корневом `CLAUDE.md`; здесь — то, что специфично для бэкенда.

## Состояние модуля

В `packages/db/prisma/schema.prisma` есть модели `User`, `Category` (FK `userId` на `User`,
`onDelete: Cascade`, `@@unique([userId, name])`) и `Transaction` (`amount Decimal(12, 2)`, enum
`TransactionType { income expense }`, FK `userId` с `Cascade` и `categoryId` с **`Restrict`**,
`@@index([userId, date])`). Помимо `GET /api/health`, есть `POST /api/auth/register`,
`POST /api/auth/login`, `GET /api/auth/me` и полный CRUD `/api/categories` и
`/api/transactions` (`POST`/`GET`/`GET :id`/`PATCH :id`/`DELETE :id`) — все эндпоинты
`categories`, `transactions` и `GET /api/auth/me` защищены `JwtAuthGuard`. Модули `users`,
`auth`, `categories` и `transactions` реализованы через CQRS, см. «Архитектуру» ниже.

`GET /api/transactions` принимает необязательные `year`, `month`, `page` и `limit`
(по умолчанию `page=1`, `limit=10`, максимум `limit=100`) и возвращает
`{ items, summary: { income, expense, balance }, pagination: { page, limit, total, totalPages } }`:
страницу списка и агрегаты. `month` без `year` даёт 400. Границы периода — полуинтервал
в UTC, чтобы не зависеть от таймзоны сервера. **`summary` и `total` считаются по всему
периоду, а не по странице**: иначе итоги менялись бы при листании одной и той же выборки.
Значения по умолчанию для `page`/`limit` заданы инициализаторами полей в
`QueryTransactionsDto` — их подставляет `transform` глобального `ValidationPipe`.

## Тесты

Тесты запускаются из корня репозитория (Jest + ts-jest, `rootDir: src`,
`testRegex: .*\.spec\.ts$`):

```bash
npm test -w @expense-tracker/api                          # все тесты
npm test -w @expense-tracker/api -- path/to/file.spec.ts   # один файл
npm test -w @expense-tracker/api -- -t "название теста"     # один тест
```

## Архитектура

**Модули общаются только через `contracts` и `common`.** `auth`, `users`, `categories` и
`transactions` не импортируют друг друга напрямую (закреплено четырьмя блоками
`no-restricted-imports` в `apps/api/eslint.config.mjs`). Общие слои
`apps/api/src/contracts/users/` и `apps/api/src/contracts/categories/` содержат классы
команд/запросов CQRS (`@nestjs/cqrs`) и read-модели; модуль-владелец таблицы регистрирует
хендлеры для них в своей папке `handlers/`, остальные вызывают их через `CommandBus`/`QueryBus`.
Так `transactions` проверяет категорию через `GetCategoryByIdQuery` перед записью и
подставляет категории в список одним `GetCategoriesByUserQuery` вместо запроса на транзакцию,
а существование самого владельца проверяет `JwtAuthGuard` — см. ниже.
Каждая таблица имеет ровно одного владельца (`users` → `User`, `categories` → `Category`,
`transactions` → `Transaction`), и владелец ничего не экспортирует из своего модуля; `auth` —
единственный, кто знает про `bcryptjs`. Импортировать из общих слоёв можно только их барели
(`index.ts`) — `no-restricted-imports` матчит сырую строку импорта и блокирует прямые пути вида
`'../contracts/users/user.read-model'`, но пропускает `'../contracts/users'`. Поэтому
`CategoryReadModel` живёт в `contracts/categories/`, а не внутри модуля `categories`:
её типом пользуется `transactions`.

**`Transaction.categoryId` объявлен с `onDelete: Restrict`**, чтобы удаление категории не уносило
историю трат. Из-за этого `P2003` в `CategoriesService.remove` значит «категорию держат
транзакции» (409), а не «пользователь не найден», как в остальных методах, — там код
обрабатывается отдельно, до общего `mapPrismaError`.

**JWT-инфраструктура вынесена в `apps/api/src/common/auth/`** (`AuthCoreModule`, `JwtAuthGuard`,
`CurrentUser`, `JwtPayload`) — она нужна и `auth`, и `categories`, и `transactions`, а
`auth`-модуль как фича-модуль не может быть импортирован другими фичами напрямую.
`AuthCoreModule` регистрирует
`JwtModule.registerAsync` и экспортирует `JwtModule` + `JwtAuthGuard`; сам он не глобальный —
модули, которым нужна авторизация, импортируют его явно в свои `imports`.

**`JwtAuthGuard` проверяет не только подпись, но и существование пользователя** —
`GetUserByIdQuery` через `QueryBus`, и 401, если записи в `User` уже нет. Валидная подпись с
непросроченным `exp` ещё не значит, что аккаунт жив, а инвариант «валидный токен
несуществующего пользователя — 401» общий для всех закрытых эндпоинтов: держать его в каждом
сервисе значит однажды забыть, и снаружи это будет неотличимо от «данных просто нет». Ценой
идёт один PK-lookup на авторизованный запрос. `QueryBus` доступен гарду потому, что
`CqrsModule.forRoot()` в `AppModule` глобальный, — `AuthCoreModule` его не импортирует;
проводка закреплена тестом в `jwt-auth.guard.spec.ts`.

**`.env` лежит в корне монорепозитория**, не в `apps/api`. `AppModule` указывает на него явно:
`ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'] })`. Начать с
`cp .env.example .env`.

**Доступ к БД в API идёт через `PrismaService`** (`apps/api/src/prisma/prisma.service.ts`) —
он наследует `PrismaClient`, получает `DATABASE_URL` через `ConfigService.getOrThrow` и
управляет `$connect`/`$disconnect` по хукам жизненного цикла. Новые модули инжектят
`PrismaService`, а не создают клиент сами.

**Глобальная конфигурация API** (`apps/api/src/main.ts`): префикс `api` у всех маршрутов,
CORS только для `http://localhost:3000`, `ValidationPipe` с
`whitelist + forbidNonWhitelisted + transform` — DTO обязаны быть классами с декораторами
`class-validator`, иначе неизвестные поля дадут 400.

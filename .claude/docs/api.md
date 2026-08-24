# API

Базовый URL: `http://localhost:3001/api` (глобальный префикс `api` задан в `main.ts`).
Swagger UI: `http://localhost:3001/api/docs` (сейчас декораторы `@ApiOperation`/`@ApiResponse`
проставлены только у `transactions`; остальные контроллеры документированы здесь и в JSDoc
кода).

Все закрытые эндпоинты защищены `JwtAuthGuard`: заголовок `Authorization: Bearer <token>`.
Guard проверяет и подпись/`exp`, и то, что пользователь из токена всё ещё существует — иначе
401. `userId` для бизнес-логики всегда берётся из токена (`@CurrentUser()`), не из тела/query.

Валидация тела запроса — `class-validator` через глобальный `ValidationPipe` с
`whitelist + forbidNonWhitelisted + transform`: лишние поля в теле дают 400, а не
игнорируются молча.

## Health

### `GET /api/health`

Без авторизации.

Ответ `200`:
```json
{ "status": "ok", "timestamp": "2026-08-24T12:00:00.000Z" }
```

## Auth (`/api/auth`)

### `POST /api/auth/register`

Без авторизации. Тело — `RegisterDto`:

| Поле       | Тип    | Правила                     |
| ---------- | ------ | ---------------------------- |
| `name`     | string | `IsString`, `MinLength(2)`   |
| `email`    | string | `IsEmail`                    |
| `password` | string | `IsString`, `MinLength(8)`   |

Ответ `201`:
```json
{ "accessToken": "<jwt>", "user": { "id": "...", "name": "...", "email": "...", "createdAt": "..." } }
```

Ошибки: `400` — не прошла валидация; `409` — email уже занят (`P2002` на `User.email`).

### `POST /api/auth/login`

Без авторизации. Тело — `LoginDto`: `email` (`IsEmail`), `password` (`IsString`,
`MinLength(8)`).

Ответ `200`: то же тело, что у `register`.

Ошибка: `401` — неверный email или пароль. Ответ одинаковый и для несуществующего email, и
для неверного пароля (не различаются), а `bcrypt.compare` в обоих случаях выполняется с
фиксированным dummy-хэшем, если пользователь не найден — время ответа не выдаёт факт
существования email.

### `GET /api/auth/me`

Требует `JwtAuthGuard`.

Ответ `200`: `UserReadModel` (`{ id, name, email, createdAt }`).

Ошибка: `401` — пользователь из токена не найден (доп. проверка внутри самого метода поверх
той, что уже делает guard).

## Categories (`/api/categories`)

Все методы требуют `JwtAuthGuard` (гард на весь контроллер). Категория всегда принадлежит
текущему пользователю; чужая категория для запросов неотличима от несуществующей (`404`, не
`403`).

### `POST /api/categories`

Тело — `CreateCategoryDto`:

| Поле    | Тип    | Правила                                                        |
| ------- | ------ | ---------------------------------------------------------------- |
| `name`  | string | `MinLength(1)`, `MaxLength(50)`                                  |
| `color` | string | regex `^#[0-9a-fA-F]{6}$` — HEX-цвет `#rrggbb`                    |
| `icon`  | string | regex `^[a-z0-9]+(-[a-z0-9]+)*$`, `MaxLength(50)` — kebab-case имя иконки lucide |

`name` тримится, `color` приводится к нижнему регистру перед записью.

Ответ `201`: `CategoryReadModel` (`{ id, name, color, icon, createdAt }`, без `userId`).

Ошибка: `409` — категория с таким `name` у этого пользователя уже есть
(`@@unique([userId, name])`).

### `GET /api/categories`

Ответ `200`: `CategoryReadModel[]`, отсортированы по `createdAt` (`asc`).

### `GET /api/categories/:id`

`id` — UUID v7 (`ParseUUIDPipe({ version: '7' })`, иначе `400`).

Ответ `200`: `CategoryReadModel`. Ошибка `404` — не найдена.

### `PATCH /api/categories/:id`

Тело — `UpdateCategoryDto`: те же поля, что у `create`, все опциональные (`PartialType` не
используется — `@nestjs/mapped-types` нет в зависимостях, поля продублированы вручную с
`@IsOptional`).

Ответ `200`: обновлённая `CategoryReadModel`. Ошибки: `404` — не найдена; `409` — конфликт
уникальности имени.

### `DELETE /api/categories/:id`

Ответ `204 No Content`.

Ошибки: `404` — не найдена; `409` — у категории есть транзакции (`Transaction.categoryId`
объявлен с `onDelete: Restrict`).

## Transactions (`/api/transactions`)

Все методы требуют `JwtAuthGuard`. Транзакция всегда принадлежит текущему пользователю; чужая
для запросов неотличима от несуществующей (`404`).

### `POST /api/transactions`

Тело — `CreateTransactionDto`:

| Поле          | Тип                      | Правила                                                        |
| ------------- | ------------------------- | ------------------------------------------------------------- |
| `amount`      | number                    | `IsPositive`, максимум 2 знака после запятой, `Max(9_999_999_999.99)` (потолок `Decimal(12,2)`) |
| `type`        | `'income' \| 'expense'`   | `IsEnum(TransactionType)`                                      |
| `description` | string                    | `MinLength(1)`, `MaxLength(200)`                                |
| `date`        | Date (ISO 8601 в теле)    | `@Type(() => Date)` + `IsDate` — невалидная дата отсекается     |
| `categoryId`  | string (UUID v7)          | `IsUUID('7')`                                                   |

Сумма всегда положительная — знак операции определяет `type`, а не `amount`.
`description` тримится перед записью.

Ответ `201`: `TransactionReadModel` — `{ id, amount, type, description, date, createdAt,
category: CategoryReadModel }` (`categoryId` заменён на подставленный объект категории).

Ошибки: `400` — не прошла валидация; `401` — не авторизован; `404` — категория не найдена
или принадлежит другому пользователю.

### `GET /api/transactions`

Query — `QueryTransactionsDto`, все параметры опциональны:

| Параметр | Тип | Правила                          | По умолчанию |
| -------- | --- | ---------------------------------- | ------------ |
| `year`   | int | `Min(2000)`, `Max(2100)`           | —            |
| `month`  | int | `Min(1)`, `Max(12)`; требует `year`, иначе `400` | — |
| `page`   | int | `Min(1)`, `Max(1_000_000)`         | `1`          |
| `limit`  | int | `Min(1)`, `Max(100)`               | `10`         |

Без `year`/`month` — все транзакции пользователя. С одним `year` — весь год. С `year` и
`month` — конкретный месяц. Границы периода — полуинтервал `[gte, lt)` в UTC (не зависит от
таймзоны сервера).

Ответ `200` — `TransactionsPage`:
```json
{
  "items": [ /* TransactionReadModel[], свежие сверху: сортировка date desc, затем createdAt desc */ ],
  "summary": { "income": 0, "expense": 0, "balance": 0 },
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

`summary` и `pagination.total` считаются по **всему периоду**, а не по текущей странице —
иначе итоги менялись бы при листании одной и той же выборки. `balance = income − expense`,
может быть отрицательным.

Ошибка: `400` — указан `month` без `year`.

### `GET /api/transactions/:id`

`id` — UUID v7. Ответ `200`: `TransactionReadModel`. Ошибка `404` — не найдена.

### `PATCH /api/transactions/:id`

Тело — `UpdateTransactionDto`: те же поля, что у `create`, все опциональные. Если передан
`categoryId`, новая категория проверяется до записи — чтобы вернуть `404`, а не сырую ошибку
FK.

Ответ `200`: обновлённая `TransactionReadModel`. Ошибки: `400`; `401`; `404` — транзакция или
указанная категория не найдены.

### `DELETE /api/transactions/:id`

Ответ `204 No Content`. Ошибка `404` — не найдена.

## Сводка кодов ошибок

| Код | Когда происходит                                                                 |
| --- | ---------------------------------------------------------------------------------- |
| 400 | Не прошла валидация DTO/query; неизвестное поле в теле; `month` без `year`         |
| 401 | Нет/невалиден токен; пользователь из токена не существует; неверный логин/пароль   |
| 404 | Ресурс не найден или принадлежит другому пользователю (включая связанную категорию) |
| 409 | Нарушение уникальности (email, имя категории); удаление категории с транзакциями   |

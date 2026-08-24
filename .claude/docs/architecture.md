# Архитектура

Монорепозиторий npm workspaces: `packages/db` (Prisma-схема и клиент), `apps/api` (NestJS,
бэкенд), `apps/web` (Next.js, фронтенд). `packages/*` идут перед `apps/*` в корневом
`package.json` — от этого зависит порядок сборки (`apps/api` использует
`@expense-tracker/db`).

```
apps/web    @expense-tracker/web  Next.js 16 App Router + React 19, Feature-Sliced Design
apps/api    @expense-tracker/api  NestJS 11 (Express), CQRS
packages/db @expense-tracker/db   Prisma 7: схема, миграции, генерируемый клиент
```

## packages/db

`packages/db/src/index.ts` — единственная точка входа для потребителей пакета:
реэкспортирует весь сгенерированный Prisma Client (`./generated/client`, не хранится в git)
и добавляет два хелпера:

- `createPgAdapter(connectionString?)` — driver adapter `@prisma/adapter-pg`. В Prisma 7 без
  Rust-движка адаптер обязателен; вынесен сюда, чтобы `apps/api` не тянул
  `@prisma/adapter-pg` напрямую.
- `createPrismaClient(connectionString?)` — готовый клиент с адаптером для скриптов вне
  Nest (сид, миграции данных).

URL подключения задаётся в `packages/db/prisma.config.ts` (Prisma 7 переносит его туда из
`schema.prisma`), а не в самой схеме.

`exports` пакета в `package.json` указывает на `dist/`, не на `src/` — исходники собирает
`tsc` через `npm run build -w @expense-tracker/db` (`generate && tsc`). Одного
`db:generate` недостаточно: он пишет только в `src/generated/`.

## apps/api — модули на CQRS

Четыре фича-модуля: `auth`, `users`, `categories`, `transactions`. Каждый — единственный
владелец одной таблицы (`users` → `User`, `categories` → `Category`, `transactions` →
`Transaction`; `auth` не владеет таблицей, инкапсулирует `bcryptjs` и выдачу JWT).

**Модули не импортируют друг друга напрямую.** Общение — только через `CommandBus`/
`QueryBus` (`@nestjs/cqrs`) и два общих слоя:

- `src/contracts/{users,categories}/` — классы команд/запросов CQRS и read-модели
  (`UserReadModel`, `CategoryReadModel` и т. д.). Модуль-владелец регистрирует хендлеры для
  них в своей папке `handlers/`; модуль-потребитель вызывает их через шину.
- `src/common/auth/` — JWT-инфраструктура (`AuthCoreModule`, `JwtAuthGuard`, `CurrentUser`,
  `JwtPayload`), нужна нескольким модулям сразу.

Правило закреплено в `apps/api/eslint.config.mjs` четырьмя блоками `no-restricted-imports`:
из `src/auth/**` запрещены прямые импорты `**/users/**`, `**/categories/**`,
`**/transactions/**`, и симметрично для остальных трёх модулей. Импортировать общие слои
можно только через их барели (`index.ts`) — правило матчит сырую строку импорта и блокирует
`'../contracts/users/user.read-model'`, но пропускает `'../contracts/users'`.

### Пример: transactions читает categories

`TransactionsService` не импортирует `CategoriesRepository`. Вместо этого:

- при создании/обновлении транзакции проверяет категорию через `GetCategoryByIdQuery`
  (`requireCategory`, `apps/api/src/transactions/transactions.service.ts:193`);
- при выдаче списка подставляет категории одним `GetCategoriesByUserQuery` вместо запроса
  на транзакцию (`findAll`, там же).

Существование пользователя (владельца) отдельно не проверяется в сервисах — за это отвечает
`JwtAuthGuard`.

### Слои внутри модуля

`Controller → Service → Repository`, плюс для команд/запросов, которые нужны другим модулям —
`Handler` (регистрируется в `handlers/`, использует тот же `Repository`).

- **Controller** — маршруты, `@UseGuards(JwtAuthGuard)`, валидация тела через DTO,
  `@CurrentUser()` для `userId` из токена.
- **Service** — бизнес-логика: проверка владения ресурсом, обёртка Prisma-ошибок в
  HTTP-исключения (`mapPrismaError`), сборка read-модели.
- **Repository** — сырые CRUD-операции через `PrismaService`, без бизнес-логики. Отдаёт
  внутренний `Record`/read-модель, а не сырую Prisma-модель.
- **Handler** (`@CommandHandler`/`@QueryHandler`) — тонкая обёртка над `Repository`,
  реализует контракт, который вызывают другие модули через шину.

`UsersModule` ничего не экспортирует из `providers` — снаружи доступен только через
`CommandBus`/`QueryBus`; так же устроены `CategoriesModule` и `TransactionsModule`.

### JwtAuthGuard

`apps/api/src/common/auth/jwt-auth.guard.ts`. Проверяет не только подпись и `exp` токена, но
и существование пользователя — запросом `GetUserByIdQuery` через `QueryBus`. Валидная подпись
ещё не значит, что аккаунт жив; инвариант «валидный токен несуществующего пользователя — 401»
общий для всех закрытых эндпоинтов и держится в одном месте, а не в каждом сервисе.
`QueryBus` доступен гарду, потому что `CqrsModule.forRoot()` в `AppModule` глобальный —
`AuthCoreModule` его не импортирует.

`AuthCoreModule` (`src/common/auth/auth-core.module.ts`) регистрирует `JwtModule.registerAsync`
(секрет и TTL из `ConfigService`) и экспортирует `JwtModule` + `JwtAuthGuard`. Не глобальный:
`auth`, `categories`, `transactions` импортируют его явно в свои `imports`.

### Обработка ошибок Prisma

Сервисы ловят `Prisma.PrismaClientKnownRequestError` по коду и превращают в HTTP-исключения
(паттерн `isPrismaError(error, code)` + приватный `mapPrismaError`):

| Код    | Значение                                          | HTTP                                |
| ------ | -------------------------------------------------- | ------------------------------------ |
| P2002  | Уникальный индекс (`@@unique([userId, name])`)     | 409 Conflict                        |
| P2025  | Строка не найдена по `(id, userId)` при update/delete | 404 Not Found                    |
| P2003  | Нарушение FK                                       | зависит от FK, см. ниже             |

`Transaction.categoryId` объявлен с `onDelete: Restrict` (а не `Cascade`), чтобы удаление
категории не уносило историю трат. Из-за этого P2003 в `CategoriesService.remove` значит
«категорию держат транзакции» → 409, а не «пользователь не найден», как в остальных методах,
и обрабатывается отдельно, до общего `mapPrismaError`. В `transactions` P2003 у обоих внешних
ключей (`categoryId`, `userId`) неразличим по коду — оба маппятся на «категория не найдена»
(404); гонка «пользователя удалили между гардом и вставкой» не отличается по коду ошибки.

Владение ресурсом (чужая запись vs несуществующая) сервисы не различают наружу: обе ситуации
дают 404, а не 403, чтобы не подтверждать существование чужих ресурсов. В репозиториях это
выражается через `userId` прямо в `where`, а не проверкой после `findUnique`.

### Глобальная конфигурация (`main.ts`)

- Префикс `api` у всех маршрутов (`app.setGlobalPrefix('api')`).
- CORS только для `http://localhost:3000`, с `credentials: true`.
- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` —
  DTO обязаны быть классами с декораторами `class-validator`, неизвестные поля дают 400.
- Swagger собирается через `SwaggerModule.createDocument`, публикуется на `api/docs`
  (`setGlobalPrefix` на сам Swagger UI не действует, поэтому префикс в пути указан явно).

## apps/web — Feature-Sliced Design

Слои сверху вниз, зависимости строго вниз: `app → views → widgets → features → entities →
shared`.

| Слой       | Каталог          | Назначение                                                          |
| ---------- | ---------------- | -------------------------------------------------------------------- |
| `app`      | `src/app`        | Роутер Next.js (App Router) и одновременно app-слой FSD: рут-лейаут, глобальные стили |
| `views`    | `src/views`      | Вёрстка страниц (аналог канонического FSD `pages`; переименован, чтобы не путать с Pages Router) |
| `widgets`  | `src/widgets`    | Композиционные блоки, общие для нескольких страниц (например, `app-sidebar`) |
| `features` | `src/features`   | Пользовательские сценарии (например, `auth`)                        |
| `entities` | `src/entities`   | Доменные сущности (например, `session`, `transaction`)              |
| `shared`   | `src/shared`     | Переиспользуемое без доменной логики: shadcn-компоненты, API-клиент, конфиги |

Слайсы одного слоя друг друга не импортируют — внутри слайса используются относительные
пути. Каждый слайс вне `shared` имеет публичный `index.ts`, снаружи импортируют только его
(`@/features/auth`, а не `@/features/auth/ui/login-form`). `shared` — исключение: в него
импортируют сегменты напрямую (`@/shared/ui/button`), барель на весь слой утянул бы в бандл
всё подряд. Всё закреплено блоками `no-restricted-imports` в `apps/web/eslint.config.mjs`
(по одному блоку на каждый слой, кроме `shared`).

shadcn/ui настроен так, что алиасы указывают в `shared`: компоненты ставятся в
`src/shared/ui`, `cn` — в `src/shared/lib/utils.ts` (`components.json`).

### Авторизация: httpOnly-кука + Server Actions

Браузер к NestJS напрямую не ходит — все запросы к API идут из серверного кода Next через
`apiFetch` (`src/shared/api/api-client.ts`), поэтому `API_URL` — серверная переменная без
префикса `NEXT_PUBLIC_`. Куку с токеном ставит Server Action логина; имя и опции куки — в
`src/shared/config/session-cookie.ts` (не в `entities/session`, потому что `proxy.ts`
работает в Edge-рантайме и не может тянуть `next/headers` через барель сущности).

`src/proxy.ts` разруливает навигацию по `exp` из payload токена **без проверки подписи** —
подпись проверяет только API.

**Три состояния сессии, а не «пользователь или null»** (`SessionState` в
`entities/session/model/session-state.ts`): `authenticated`, `unauthenticated` (API ответил
401) и `unavailable` (API недоступен или 5xx). Различать последние два обязательно: proxy
пускает на закрытые страницы по `exp` токена, и если любой отказ API уводит на `/login`, то
при живом по `exp` токене без реальной сессии (лежит API, пользователя удалили, сменили
`JWT_SECRET`) proxy вернёт обратно — редиректы зациклятся, а куку руками не почистить, она
httpOnly. Поэтому:

- `unauthenticated` → редирект на `/logout` (`src/app/logout/route.ts`), который сбрасывает
  куку и только затем отправляет на `/login` (нужен отдельный route handler, потому что
  серверный компонент куки менять не может);
- `unavailable` → без редиректа, страница показывает ошибку.

Тот же приём (`ok` / `unauthenticated` / `unavailable`) повторяет `TransactionsState` в
`getTransactions()` — любой запрос к API из страницы обязан различать «отказано» и «не
смогли спросить».

Токен читает общий `getSessionToken()` (`src/shared/api/session-auth.ts`), а не каждый слайс
самостоятельно — он нужен и `entities/session`, и `entities/transaction`, а соседние слайсы
одного слоя друг друга импортировать не могут.

### Группа роутов `(app)`

Закрытые разделы (`/dashboard`, `/transactions`, `/categories`) собраны в
`src/app/(app)/`. Лейаут группы один раз проверяет сессию и рисует `AppSidebar` — сами
страницы внутри не повторяют обработку `unauthenticated`/`unavailable`. Скобки — только
группировка роутов, на URL не влияют. Новый закрытый раздел добавляется тремя правками:
страница внутри `(app)`, путь в `ROUTES` (`src/shared/config/routes.ts`) и он же в
`matcher`/`PRIVATE_ROUTES` в `src/proxy.ts`.

### Загрузка `.env`

Next читает `.env` только рядом с приложением, а он лежит в корне монорепозитория. Поэтому
`src/instrumentation.ts` под проверкой `NEXT_RUNTIME === 'nodejs'` динамически импортирует
`instrumentation.node.ts`, который вызывает `loadEnvConfig` из `@next/env`; сам
`next.config.ts` для этого не подходит — он выполняется в отдельном процессе, и
`process.env` серверного рантайма от него не наследуется. Node-модули держатся именно в
`instrumentation.node.ts`, а не в `instrumentation.ts`, потому что последний собирается и для
Edge-рантайма.

### Сайдбар без shadcn `sidebar`

`AppSidebar` (`src/widgets/app-sidebar`) написан руками: готовый shadcn-компонент тянет
sheet, tooltip, skeleton, separator, провайдер состояния и куку сворачивания — избыточно для
статичного меню из трёх пунктов. Сам сайдбар — серверный компонент, клиентская только
подсветка активного пункта (`nav-links.tsx`, `usePathname`). На узком экране переключается в
верхнюю полосу CSS-ом, без JS.

## Общие конвенции монорепозитория

- TypeScript закреплён на 5.9.3 во всех workspace (требование `@nestjs/cli`, `ts-jest`,
  `typescript-eslint`).
- `tsconfig.base.json`: `strict` + `noUncheckedIndexedAccess` — индексный доступ и
  `process.env['X']` дают `T | undefined`, обрабатываются явно.
- ESLint — flat config: корневой `eslint.config.mjs` базовый, `apps/api` и `apps/web`
  импортируют его и дополняют своими блоками `no-restricted-imports`.
- Prettier: одинарные кавычки, точки с запятой, `printWidth: 100`, `trailingComma: all`.
- Комментарии и описания в коде — на русском.

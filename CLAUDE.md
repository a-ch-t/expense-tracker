# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Состояние проекта

Монорепозиторий с авторизацией, категориями трат и учётом доходов/расходов. В `schema.prisma`
есть модели `User`, `Category` (FK `userId` на `User`, `onDelete: Cascade`,
`@@unique([userId, name])`) и `Transaction` (`amount Decimal(12, 2)`, enum
`TransactionType { income expense }`, FK `userId` с `Cascade` и `categoryId` с **`Restrict`**,
`@@index([userId, date])`). У API, помимо `GET /api/health`, есть `POST /api/auth/register`,
`POST /api/auth/login`, `GET /api/auth/me` и полный CRUD `/api/categories` и
`/api/transactions` (`POST`/`GET`/`GET :id`/`PATCH :id`/`DELETE :id`) — все эндпоинты
`categories`, `transactions` и `GET /api/auth/me` защищены `JwtAuthGuard`. Модули `users`,
`auth`, `categories` и `transactions` реализованы через CQRS, см. «Архитектуру» ниже.
На фронте есть страницы `/login`, `/register`, `/dashboard`, а также заглушки правовых
документов `/terms` и `/privacy` (текста в них пока нет), построенные по Feature-Sliced
Design, см. «Архитектуру» ниже. **UI транзакций и категорий ещё нет** — фронт про них
не знает.

`GET /api/transactions` принимает необязательные `year` и `month` и возвращает
`{ items, summary: { income, expense, balance } }`: список за период и агрегаты по нему же
(`groupBy` считает БД). `month` без `year` даёт 400. Границы периода — полуинтервал в UTC,
чтобы не зависеть от таймзоны сервера.

## Команды

Все команды запускаются из корня репозитория.

| Команда                                           | Что делает                                                  |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `npm install`                                     | Установить зависимости всех workspace                       |
| `npm run db:up` / `db:down`                       | PostgreSQL 17 в Docker (порт 5432)                          |
| `npm run db:generate`                             | Prisma Client → `packages/db/src/generated/`                |
| `npm run db:migrate`                              | `prisma migrate dev`                                        |
| `npm run build -w @expense-tracker/db`            | Клиент → `packages/db/dist/`, обязателен после правки схемы |
| `npm run db:seed` / `db:studio`                   | Сид и Prisma Studio                                         |
| `npm run dev:api`                                 | NestJS в watch-режиме, http://localhost:3001/api            |
| `npm run dev:web`                                 | Next.js, http://localhost:3000                              |
| `npm run lint` / `format` / `typecheck` / `build` | По всему монорепо                                           |

`dev:api` и `dev:web` — в разных терминалах: `npm run --workspaces` выполняет скрипты
последовательно и не поднимет два dev-сервера сразу.

Тесты есть только у API (Jest + ts-jest, `rootDir: src`, `testRegex: .*\.spec\.ts$`):

```bash
npm test -w @expense-tracker/api                          # все тесты
npm test -w @expense-tracker/api -- path/to/file.spec.ts   # один файл
npm test -w @expense-tracker/api -- -t "название теста"     # один тест
```

## Архитектура

```
apps/web    @expense-tracker/web  Next.js 16 App Router + React 19, Tailwind 4, shadcn/ui
apps/api    @expense-tracker/api  NestJS 11 (Express)
packages/db @expense-tracker/db   Prisma 7: схема, миграции, генерируемый клиент
```

**Порядок workspaces в корневом `package.json` значим:** `packages/*` идут перед `apps/*`, потому
что npm выполняет скрипты воркспейсов в этом порядке, а `apps/api` зависит от
`@expense-tracker/db`.

**Prisma 7 без Rust-движка.** Driver adapter обязателен. `packages/db/src/index.ts` — единственное
место, где живёт `@prisma/adapter-pg`: оно экспортирует `createPgAdapter()` (адаптер) и
`createPrismaClient()` (готовый клиент для скриптов вне Nest — seed, миграции данных) и реэкспортирует
весь сгенерированный клиент. Потребители импортируют только из `@expense-tracker/db`.

**`packages/db/src/generated/` не в git.** До первого `npm run db:generate` импорт
`./generated/client` не резолвится, и `typecheck`/`build` падают.

**Одного `db:generate` после правки схемы мало — нужен `npm run build -w @expense-tracker/db`.**
Потребители импортируют `@expense-tracker/db`, а `exports` пакета указывает на `dist/`, не на
`src/` (алиасов `paths` на исходники нет). `prisma generate` пишет в `src/generated/`, перенести
это в `dist/` может только `tsc`, а его запускает лишь скрипт `build`
(`npm run generate && tsc`) — `typecheck` у пакета это `tsc --noEmit` и не эмитит ничего.
Поэтому пока `dist/` не пересобран, новые модели снаружи не видны:
`TS2305: Module '"@expense-tracker/db"' has no exported member 'TransactionType'`. Корневой
`npm run build` делает это сам (`packages/*` идут раньше `apps/*`, см. выше), а
`npm run typecheck`, `npm test -w @expense-tracker/api` и `npm run dev:api` — нет, они читают
устаревший `dist/`. Рабочий порядок: `db:migrate` (он сам зовёт `generate`) →
`build -w @expense-tracker/db` → всё остальное.

**URL подключения задаётся в `packages/db/prisma.config.ts`, а не в `schema.prisma`** (так в
Prisma 7). npm workspace-скрипты запускают этот файл с `cwd = packages/db`, поэтому путь к
корневому `.env` конфиг указывает явно: `config({ path: '../../.env' })` — обычный
`import 'dotenv/config'` искал бы `.env` рядом с собой и не находил.

**Фронтенд построен по Feature-Sliced Design.** Слои: `src/shared` (переиспользуемое без
доменной логики — компоненты shadcn, клиент API, конфиги), `src/entities` (доменные сущности,
например `session`), `src/features` (пользовательские сценарии, например `auth`), `src/views`
(вёрстка страниц), `src/app` (роутер Next.js и одновременно app-слой FSD: глобальные стили,
рут-лейаут).

Правило зависимостей строго вниз: `app → views → features → entities → shared`. Слайсы одного
слоя друг друга не импортируют — внутри слайса используются относительные пути. Каждый слайс вне
`shared` имеет публичный `index.ts`, и снаружи импортируют только его (`@/features/auth`,
а не `@/features/auth/ui/login-form`). `shared` — исключение: в него импортируют сегменты
напрямую (`@/shared/ui/button`), потому что барель на весь слой утянул бы в бандл всё подряд.
Всё это закреплено блоками `no-restricted-imports` в `apps/web/eslint.config.mjs`.

Слой страниц называется `views`, а не канонический для FSD `pages`: имя `pages` в проекте на
Next читалось бы как Pages Router.

**Алиасы shadcn указывают в `shared`** (`components.json`): компоненты ставятся в
`src/shared/ui`, `cn` живёт в `src/shared/lib/utils.ts`.

**Корневой `.env` попадает во фронтенд через `src/instrumentation.ts`.** Next читает `.env`
только рядом с приложением (`apps/web`), а он лежит в корне монорепозитория. Загрузить его в
`next.config.ts` нельзя: конфиг исполняется в отдельном процессе, и `process.env` серверного
рантайма от него не наследуется — переменные молча не доходят до кода, а `getApiUrl()` падает на
каждом запросе. Поэтому `register()` из `instrumentation.ts` под проверкой
`NEXT_RUNTIME === 'nodejs'` динамически импортирует `instrumentation.node.ts`, а тот зовёт
`loadEnvConfig` из `@next/env`. Node-модули нужно держать именно в `instrumentation.node.ts`:
файл `instrumentation.ts` собирается и для Edge, и прямой импорт `node:path` там ломает бандл.
Путь к корню считается от `process.cwd()` — Turbopack принимает
`new URL('...', import.meta.url)` за импорт ресурса и пытается его резолвить.

**Авторизация на фронте — httpOnly cookie, которую ставит Server Action.** Браузер в NestJS
напрямую не ходит: все запросы к API идут из серверного кода Next через `apiFetch`
(`src/shared/api/api-client.ts`), поэтому адрес API — серверная переменная `API_URL`
без префикса `NEXT_PUBLIC_`. `src/proxy.ts` разруливает навигацию, читая `exp` из payload
токена без проверки подписи — подпись проверяет API. Имя и опции куки лежат в
`src/shared/config/session-cookie.ts`, а не в `entities/session`, потому что proxy работает
в Edge-рантайме и не может тянуть `next/headers` через барель сущности.

**`getSession()` возвращает три состояния, а не «пользователь или null»** (`SessionState`):
`authenticated`, `unauthenticated` (API ответил 401) и `unavailable` (API недоступен или 5xx).
Различать последние два обязательно. Proxy пускает на закрытые страницы по `exp`, поэтому если
страница на любой отказ уводит на `/login`, то при живом по `exp` токене без сессии — лежит API,
пользователя удалили, сменили `JWT_SECRET` — proxy вернёт обратно, и редиректы зациклятся
(куку руками не почистить, она `httpOnly`). Поэтому `unauthenticated` уводит на роут
`/logout` (`src/app/logout/route.ts`), который сбрасывает куку и только затем отправляет на
`/login`, а `unavailable` не редиректит вовсе — страница показывает ошибку. Роут нужен потому,
что серверный компонент куки менять не может.

**Модули общаются только через `contracts` и `common`.** `auth`, `users`, `categories` и
`transactions` не импортируют друг друга напрямую (закреплено четырьмя блоками
`no-restricted-imports` в `apps/api/eslint.config.mjs`). Общие слои
`apps/api/src/contracts/users/` и `apps/api/src/contracts/categories/` содержат классы
команд/запросов CQRS (`@nestjs/cqrs`) и read-модели; модуль-владелец таблицы регистрирует
хендлеры для них в своей папке `handlers/`, остальные вызывают их через `CommandBus`/`QueryBus`.
Так `categories` проверяет существование владельца через `GetUserByIdQuery` перед созданием
категории, а `transactions` — и владельца, и категорию (`GetCategoryByIdQuery`), плюс
подставляет категории в список одним `GetCategoriesByUserQuery` вместо запроса на транзакцию.
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

## Конвенции

- **TypeScript закреплён на 5.9.3** во всех workspace — это точная версия, которую требует
  `@nestjs/cli`; `ts-jest` и `typescript-eslint` тоже не принимают 7.x. Не поднимать.
- `tsconfig.base.json` включает `strict` и `noUncheckedIndexedAccess`: индексный доступ и
  `process.env['X']` дают `T | undefined` — обрабатывать явно (в коде используется запись
  `process.env['DATABASE_URL']`, а не через точку).
- ESLint — flat config: корневой `eslint.config.mjs` базовый, конфиги в `apps/*` импортируют его и
  дополняют. Неиспользуемые переменные разрешены только с префиксом `_`.
- Prettier: одинарные кавычки, точки с запятой, `printWidth: 100`, `trailingComma: all`.
- shadcn/ui настроен на стиль `new-york`, RSC, `baseColor: neutral`, иконки lucide;
  компоненты ставятся в `@/shared/ui` (каталога `src/components/` в проекте нет —
  алиасы в `components.json` перенацелены на слой `shared`, см. «Архитектуру»).
- Комментарии и описания в коде — на русском, как в существующих файлах.

## Коммиты

Conventional Commits, текст на русском:

```
<тип>(<область>): <что делает коммит>

<почему сделано именно так>

Co-Authored-By: ...
```

- **Типы:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`. Ломающее изменение —
  `!` перед двоеточием плюс абзац `BREAKING CHANGE: ...` в футере.
- **Область** — workspace, которого касается правка: `api`, `web`, `db`. Опускается, когда
  изменение задевает несколько workspace сразу или лежит в корне репозитория.
- **Заголовок** — императив со строчной буквы, без точки в конце, не длиннее 72 символов:
  «добавить учёт расходов», а не «добавлен» и не «добавил». 72 — граница, за которой строку
  обрезает `git log --oneline` и интерфейс GitHub.
- **Тело** — через пустую строку, перенос по 72 символа. Отвечает на «почему», а не на «что»:
  что изменилось, видно в диффе, а причина видна только здесь. Неочевидные решения вроде
  `onDelete: Restrict` или обхода запрета импортов между модулями объясняются именно в теле.
- **Всё, что лежит в `.claude/`** (планы, промпты, шаблоны), коммитится как `docs` — это
  документация задачи, а не код и не обслуживание репозитория.
- Коммит, сделанный Claude, заканчивается футером
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

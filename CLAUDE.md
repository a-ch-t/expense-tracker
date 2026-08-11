# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Состояние проекта

Каркас монорепозитория с авторизацией и категориями трат. В `schema.prisma` есть модели `User`
и `Category` (FK `userId` на `User`, `onDelete: Cascade`, `@@unique([userId, name])`). У API,
помимо `GET /api/health`, есть `POST /api/auth/register`, `POST /api/auth/login`,
`GET /api/auth/me` и полный CRUD `/api/categories` (`POST`/`GET`/`GET :id`/`PATCH :id`/
`DELETE :id`) — все эндпоинты `categories` и `GET /api/auth/me` защищены `JwtAuthGuard`.
Модули `users`, `auth` и `categories` реализованы через CQRS, см. «Архитектуру» ниже.
На фронте есть страницы `/login`, `/register` и `/dashboard`, построенные по Feature-Sliced
Design, см. «Архитектуру» ниже.

## Команды

Все команды запускаются из корня репозитория.

| Команда                                           | Что делает                                       |
| ------------------------------------------------- | ------------------------------------------------ |
| `npm install`                                     | Установить зависимости всех workspace            |
| `npm run db:up` / `db:down`                       | PostgreSQL 17 в Docker (порт 5432)               |
| `npm run db:generate`                             | Prisma Client → `packages/db/src/generated/`     |
| `npm run db:migrate`                              | `prisma migrate dev`                             |
| `npm run db:seed` / `db:studio`                   | Сид и Prisma Studio                              |
| `npm run dev:api`                                 | NestJS в watch-режиме, http://localhost:3001/api |
| `npm run dev:web`                                 | Next.js, http://localhost:3000                   |
| `npm run lint` / `format` / `typecheck` / `build` | По всему монорепо                                |

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
`./generated/client` не резолвится, и `typecheck`/`build` падают. Любая правка `schema.prisma`
требует повторной генерации.

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

**Авторизация на фронте — httpOnly cookie, которую ставит Server Action.** Браузер в NestJS
напрямую не ходит: все запросы к API идут из серверного кода Next через `apiFetch`
(`src/shared/api/api-client.ts`), поэтому адрес API — серверная переменная `API_URL`
без префикса `NEXT_PUBLIC_`. `src/proxy.ts` разруливает навигацию, читая `exp` из payload
токена без проверки подписи — подпись проверяет API. Имя и опции куки лежат в
`src/shared/config/session-cookie.ts`, а не в `entities/session`, потому что proxy работает
в Edge-рантайме и не может тянуть `next/headers` через барель сущности.

**Модули общаются только через `contracts` и `common`.** `auth`, `users` и `categories` не
импортируют друг друга напрямую (закреплено тремя блоками `no-restricted-imports` в
`apps/api/eslint.config.mjs`). Общий слой `apps/api/src/contracts/users/` содержит классы
команд/запросов CQRS (`@nestjs/cqrs`) и read-модели; `users` регистрирует хендлеры для них,
`auth` и `categories` вызывают их через `CommandBus`/`QueryBus` (например, `categories` проверяет
существование владельца через `GetUserByIdQuery` перед созданием категории). `users` —
единственный владелец таблицы `User` и ничего не экспортирует из своего модуля; `auth` —
единственный, кто знает про `bcryptjs`. Импортировать из общих слоёв можно только их барели
(`index.ts`) — `no-restricted-imports` матчит сырую строку импорта и блокирует прямые пути вида
`'../contracts/users/user.read-model'`, но пропускает `'../contracts/users'`.

**JWT-инфраструктура вынесена в `apps/api/src/common/auth/`** (`AuthCoreModule`, `JwtAuthGuard`,
`CurrentUser`, `JwtPayload`) — она нужна и `auth`, и `categories`, а `auth`-модуль как фича-модуль
не может быть импортирован другими фичами напрямую. `AuthCoreModule` регистрирует
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
  компоненты ставятся в `@/components/ui`.
- Комментарии и описания в коде — на русском, как в существующих файлах.

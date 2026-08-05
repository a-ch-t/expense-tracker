# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Состояние проекта

Каркас монорепозитория с авторизацией. В `schema.prisma` есть модель `User`. У API, помимо
`GET /api/health`, есть `POST /api/auth/register`, `POST /api/auth/login` и `GET /api/auth/me`
(за `JwtAuthGuard`) — реализованы через CQRS-модули `users` и `auth`, см. «Архитектуру» ниже.
`apps/web/src/components/ui/` пуст.

## Команды

Все команды запускаются из корня репозитория.

| Команда | Что делает |
| --- | --- |
| `npm install` | Установить зависимости всех workspace |
| `npm run db:up` / `db:down` | PostgreSQL 17 в Docker (порт 5432) |
| `npm run db:generate` | Prisma Client → `packages/db/src/generated/` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` / `db:studio` | Сид и Prisma Studio |
| `npm run dev:api` | NestJS в watch-режиме, http://localhost:3001/api |
| `npm run dev:web` | Next.js, http://localhost:3000 |
| `npm run lint` / `format` / `typecheck` / `build` | По всему монорепо |

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

**Модули общаются только через `contracts`.** `auth` и `users` не импортируют друг друга напрямую
(это закреплено правилом `no-restricted-imports` в `apps/api/eslint.config.mjs`). Общий слой
`apps/api/src/contracts/users/` содержит классы команд/запросов CQRS (`@nestjs/cqrs`) и
read-модели; `users` регистрирует хендлеры для них, `auth` вызывает их через `CommandBus`/
`QueryBus`. `users` — единственный владелец таблицы `User` и ничего не экспортирует из своего
модуля; `auth` — единственный, кто знает про `bcryptjs` и `JwtService`.

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

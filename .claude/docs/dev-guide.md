# Руководство разработчика

## Первый запуск

```bash
npm install
cp .env.example .env          # заполнить DATABASE_URL, JWT_SECRET и т. д.
npm run db:up                 # PostgreSQL 17 в Docker
npm run db:migrate            # применяет миграции, сам вызывает db:generate
npm run build -w @expense-tracker/db   # dist/ нужен всем потребителям пакета
npm run db:seed               # demo@example.com / demo-password
```

Затем в двух терминалах: `npm run dev:api` (http://localhost:3001/api) и
`npm run dev:web` (http://localhost:3000). `npm run --workspaces` выполняет скрипты
последовательно и не поднимет оба сервера сразу.

## Добавление миграции схемы

1. Правки — в `packages/db/prisma/schema.prisma`.
2. `npm run db:migrate` (= `prisma migrate dev` в `packages/db`) — создаёт файл миграции в
   `packages/db/prisma/migrations/` и сам вызывает `prisma generate`.
3. **Обязательно** `npm run build -w @expense-tracker/db` — `db:generate`/`db:migrate` пишут
   типы только в `src/generated/`, а потребители (`@expense-tracker/db`) резолвятся через
   `exports` пакета в `dist/`. Пока `dist/` не пересобран, новые модели/поля не видны снаружи:
   `TS2305: Module '"@expense-tracker/db"' has no exported member '...'`.
   `npm run typecheck`, `npm test -w @expense-tracker/api` и `npm run dev:api` сами `dist/`
   не пересобирают — только корневой `npm run build` делает это автоматически (`packages/*`
   идут раньше `apps/*`).
4. Если новая модель нужна другому модулю API — завести под неё `contracts/<модель>/` (см.
   ниже), а не открывать прямой доступ к таблице.
5. Если меняется состав демо-данных — обновить `packages/db/prisma/seed.ts` и абзац о сиде в
   корневом `CLAUDE.md`.

Рабочий порядок целиком: `db:migrate` → `build -w @expense-tracker/db` → всё остальное.

## Добавление нового модуля API (владельца новой таблицы)

Ориентир — `apps/api/src/categories/` (более простой, чем `transactions`, но с полным
набором CRUD и CQRS-хендлеров).

1. **Схема и клиент.** Модель в `packages/db/prisma/schema.prisma`, миграция, пересборка
   `@expense-tracker/db` — см. «Добавление миграции» выше.

2. **`contracts/<domain>/`** — если сущность понадобится другим модулям:
   - `*.read-model.ts` — публичный интерфейс без внутренних деталей (без `userId`, если он
     всегда равен текущему пользователю — см. `CategoryReadModel`).
   - Классы команд/запросов CQRS, по одному файлу на класс (`get-x-by-id.query.ts`,
     `create-x.command.ts`) — простые классы с `readonly` полями в конструкторе.
   - `index.ts` — барель, реэкспортирует всё перечисленное. Снаружи `contracts/<domain>`
     импортируется только через него (см. правило `no-restricted-imports` в архитектуре).

3. **Сам модуль `<domain>/`:**
   - `dto/create-<x>.dto.ts`, `update-<x>.dto.ts` — классы с декораторами `class-validator`
     (`IsString`, `IsUUID('7')` и т. п.); `Update*` дублирует поля `Create*` с `IsOptional`
     вручную (`@nestjs/mapped-types`/`PartialType` в зависимостях нет).
   - `<domain>.repository.ts` — CRUD через `PrismaService`, `userId` прямо в `where` для
     операций над одной записью (`findFirst`/`update`/`delete` с `{ id, userId }`), не
     отдельная проверка владения после `findUnique`. Возвращает read-модель, а не сырую
     Prisma-модель (приватный `toReadModel`/`toRecord`).
   - `<domain>.service.ts` — бизнес-логика: тримминг строк, проверка владения через
     `NotFoundException` (не `ForbiddenException` — чужой ресурс не должен отличаться от
     несуществующего), `mapPrismaError` для кодов `P2002`/`P2025`/`P2003` (см. таблицу в
     `architecture.md`).
   - `<domain>.controller.ts` — `@Controller('<domain>')`, `@UseGuards(JwtAuthGuard)` на весь
     класс, `@CurrentUser() user: JwtPayload` для `userId`, `ParseUUIDPipe({ version: '7' })`
     на параметрах `:id`.
   - Если сущность нужна другим модулям — `handlers/get-<x>-by-id.handler.ts` и т. п.:
     `@QueryHandler(GetXByIdQuery)` / `@CommandHandler(...)`, тонкая обёртка над репозиторием.
   - `<domain>.module.ts` — регистрирует контроллер, сервис, репозиторий и хендлеры;
     импортирует `AuthCoreModule`, если есть закрытые эндпоинты. Ничего не экспортирует —
     наружу модуль виден только через `CommandBus`/`QueryBus`.

4. **Подключить модуль** в `imports` `apps/api/src/app.module.ts`.

5. **Импортные ограничения.** Новый модуль не должен импортировать другие фича-модули
   напрямую — только их `contracts/*`. Добавить в `apps/api/eslint.config.mjs` блок
   `no-restricted-imports` для `src/<domain>/**/*.ts`, запрещающий `**/<other-module>/**` для
   всех существующих модулей (симметрично добавить `**/<domain>/**` в блоки остальных
   модулей).

6. **Тесты.** `*.spec.ts` рядом с файлом, который проверяют (`rootDir: src`,
   `testRegex: .*\.spec\.ts$`). Для сервиса — мокать репозиторий и/или `QueryBus`/
   `CommandBus`, не поднимать реальную БД (см. `categories.service.spec.ts`,
   `transactions.service.spec.ts`).

## Добавление эндпоинта в существующий модуль

1. Метод в `<domain>.repository.ts` (если нужен новый запрос к БД).
2. Метод в `<domain>.service.ts` — бизнес-логика и маппинг ошибок.
3. Метод в `<domain>.controller.ts` с HTTP-декоратором, `ParseUUIDPipe` для `:id`,
   DTO для тела/query. Для `transactions` — добавить и JSDoc, и Swagger-декораторы
   (`@ApiOperation`, `@ApiResponse`) по образцу уже существующих методов.
4. Обновить `.claude/docs/api.md` — новый эндпоинт, DTO, коды ошибок.
5. Тест на сервис — happy path и как минимум одна ветка ошибки.

## Добавление фичи на фронтенде (FSD)

Ориентир — `apps/web/src/features/auth/` и `apps/web/src/entities/transaction/`.

1. **Определить слой** по правилу `app → views → widgets → features → entities → shared`:
   - доменная сущность и её состояние (типы, API-запрос, базовые UI-примитивы вроде карточки
     записи) → `entities/<entity>`;
   - пользовательский сценарий (форма, действие, Server Action) → `features/<feature>`;
   - блок, общий для нескольких страниц (шапка, сайдбар) → `widgets/<widget>`;
   - вёрстка конкретной страницы → `views/<view>`.

2. **Структура слайса:** `api/` (запросы к API, Server Actions), `model/` (типы, состояние,
   схемы валидации), `ui/` (компоненты), `index.ts` — публичный барель. Внутри слайса —
   только относительные импорты; из другого слайса того же слоя импортировать нельзя.

3. **Публичный интерфейс** — только `index.ts` слайса (`@/features/auth`, не
   `@/features/auth/ui/login-form`). Исключение — `shared`: туда импортируют сегменты
   напрямую (`@/shared/ui/button`, `@/shared/lib/format`).

4. **Ограничения зависимостей закреплены в ESLint** (`apps/web/eslint.config.mjs`, блок
   `no-restricted-imports` на каждый слой). Новый слайс автоматически подпадает под
   ограничение своего слоя — отдельно ничего конфигурировать не нужно, если слой уже
   существует.

5. **Страница Next.js** (если фича добавляет роут):
   - файл в `src/app/(app)/<route>/page.tsx` для закрытого раздела или в
     `src/app/(auth)/<route>/page.tsx` для публичного;
   - сама страница — тонкая обёртка, вызывающая компонент из `views/<view>`;
   - для закрытого раздела: добавить путь в `ROUTES` (`src/shared/config/routes.ts`) и в
     `matcher`/`PRIVATE_ROUTES` в `src/proxy.ts`.

6. **Запросы к API** — через `apiFetch` (`src/shared/api/api-client.ts`), не `fetch` напрямую;
   токен — через `getSessionToken()` (`src/shared/api/session-auth.ts`). Результат запроса,
   различающий отказ и недоступность API, оформлять как отдельный union-тип состояния
   (`'ok' | 'unauthenticated' | 'unavailable'`), как `SessionState`/`TransactionsState` — не
   схлопывать в `null`/исключение.

7. Проверить фичу в браузере (`npm run dev:web`) — golden path и как минимум один edge case
   (пустая выборка, ошибка валидации формы).

## Перед вливанием ветки

Из корня репозитория, в этом порядке:

```bash
npm run build                              # пересобирает и @expense-tracker/db
npm run lint
npm run typecheck
npm test -w @expense-tracker/api
```

Ветка вливается только зелёной. Дальше — по разделу «Ветки» корневого `CLAUDE.md`:
merge-коммитом (`--no-ff`) в `main`, PR в GitHub, удаление ветки после вливания.

## Частые ошибки

| Симптом                                                                 | Причина                                                                 | Решение |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------- |
| `TS2305: Module '"@expense-tracker/db"' has no exported member 'X'`     | После правки схемы не пересобран `dist/` пакета `db`                       | `npm run build -w @expense-tracker/db` |
| Импорт `./generated/client` не резолвится                                | Ни разу не выполнялся `db:generate`/`db:migrate`                           | `npm run db:migrate` (или `db:generate`), затем `build -w @expense-tracker/db` |
| `getApiUrl()`/`DATABASE_URL не задан` на каждом запросе                  | Переменные из корневого `.env` не подставлены (сборка/скрипт запущены не так, как ожидает загрузчик `.env`) | Проверить, что `.env` в корне репозитория заполнен по `.env.example`; для API — `envFilePath: ['../../.env']` в `AppModule`, для web — `instrumentation.ts`, для сида/Prisma CLI — `dotenv`/`prisma.config.ts` |
| Циклический импорт между `auth`/`users`/`categories`/`transactions` не даёт собраться / падает ESLint | Модули общаются только через `contracts`/`common`, прямые импорты запрещены `no-restricted-imports` | Завести/использовать контракт (CQRS-команда/запрос) вместо прямого импорта сервиса другого модуля |
| ESLint ругается на импорт внутри FSD-слайса на фронте                    | Импорт минуя публичный `index.ts` слайса, либо импорт соседнего слайса того же слоя | Импортировать только барель слайса; между слайсами одного слоя обращаться через слой ниже, а не напрямую |
| При листании транзакций меняются `summary`/`total`                       | Сводка и общее число посчитаны по странице, а не по всему периоду           | Считать `summary`/`total` без `skip`/`take` — отдельными запросами по тому же `where`, см. `TransactionsRepository.summarize`/`countByUser` |

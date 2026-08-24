# Expense Tracker

Трекер расходов и доходов: авторизация, категории трат и учёт операций с фильтрацией по
периоду. Монорепозиторий на npm workspaces.

## Стек

| Слой     | Технология                    | Версия  |
| -------- | ------------------------------ | ------- |
| Frontend | Next.js (App Router) + React  | 16 / 19 |
| Стили    | Tailwind CSS + shadcn/ui      | 4       |
| Backend  | NestJS (Express) + CQRS       | 11      |
| ORM      | Prisma + `@prisma/adapter-pg` | 7       |
| БД       | PostgreSQL в Docker            | 17      |
| Язык     | TypeScript                     | 5.9.3   |

> TypeScript закреплён на 5.9.3, а не на 7.x: `@nestjs/cli` тянет ровно `5.9.3`,
> `ts-jest` объявляет peer `>=4.3 <7`, `typescript-eslint` — `>=4.8.4 <6.1.0`.

## Требования

- Node.js ≥ 22
- Docker (для PostgreSQL через `docker-compose.yml`)

## Быстрый старт

```bash
npm install                # установить зависимости всех workspace
cp .env.example .env       # прописать переменные окружения (см. ниже)

npm run db:up               # поднять PostgreSQL 17 в Docker (порт 5432)
npm run db:migrate          # применить миграции (сам вызывает db:generate)
npm run build -w @expense-tracker/db   # собрать пакет @expense-tracker/db — обязательно
                                        # после генерации клиента, иначе apps/api и apps/web
                                        # не увидят новые модели/типы
npm run db:seed              # опционально: демо-пользователь и тестовые данные

npm run dev:api              # бэкенд:  http://localhost:3001/api (Swagger — /api/docs)
npm run dev:web              # фронтенд: http://localhost:3000
```

`dev:api` и `dev:web` запускаются в **разных терминалах**: `npm run --workspaces` выполняет
скрипты воркспейсов последовательно и не поднимет два dev-сервера одновременно.

### Переменные окружения

Корневой `.env` (используется и `apps/api`, и `apps/web`, и `packages/db`):

| Переменная       | Назначение                                              | По умолчанию |
| ---------------- | -------------------------------------------------------- | ------------ |
| `DATABASE_URL`   | Строка подключения к PostgreSQL (обязательна)             | —            |
| `JWT_SECRET`     | Секрет для подписи access-токенов (обязательна)            | —            |
| `JWT_EXPIRES_IN` | Срок жизни access-токена                                  | `15m`        |
| `PORT`           | Порт, на котором слушает API                                | `3001`       |
| `API_URL`        | Адрес API, который использует фронтенд для серверных запросов | —            |

Для локального Docker из `docker-compose.yml` (`POSTGRES_USER=expense`,
`POSTGRES_PASSWORD=expense`, `POSTGRES_DB=expense_tracker`) строка подключения:

```
DATABASE_URL="postgresql://expense:expense@localhost:5432/expense_tracker"
```

### База данных

- `npm run db:up` / `npm run db:down` — поднять/остановить PostgreSQL в Docker.
- `npm run db:migrate` — применить миграции Prisma (`prisma migrate dev`); сам вызывает
  `db:generate`.
- `npm run build -w @expense-tracker/db` — пересобрать пакет `@expense-tracker/db` после любой
  правки схемы. Без этого шага `typecheck`, тесты и `dev:api` продолжат видеть устаревший
  `dist/` и не увидят новые модели.
- `npm run db:seed` — наполнить БД демо-данными: пользователь `demo@example.com` / пароль
  `demo-password`, пять категорий, тринадцать операций за два месяца. Сид **приводит аккаунт
  к этому состоянию, а не дополняет его** — существующие операции и лишние категории для этого
  email удаляются перед вставкой.
- `npm run db:studio` — Prisma Studio.

## Структура проекта

```
apps/
  web/                       @expense-tracker/web — Next.js, порт 3000
    src/
      app/                   роутер Next.js + глобальные стили (app-слой FSD)
      views/                 вёрстка страниц (login, register, dashboard, transactions, categories, legal)
      widgets/               композиционные блоки (app-sidebar)
      features/              пользовательские сценарии (auth)
      entities/              доменные сущности (session, transaction)
      shared/                переиспользуемое без доменной логики: ui (shadcn), api-клиент, конфиги
  api/                       @expense-tracker/api — NestJS, порт 3001
    src/
      auth/                  регистрация, вход, JWT
      categories/            CRUD категорий
      transactions/          CRUD операций, сводка и пагинация
      users/                 модуль-владелец таблицы User
      contracts/             CQRS-команды/запросы и read-модели для общения между модулями
      common/auth/           общая JWT-инфраструктура (guard, decorator, модуль)
      prisma/                PrismaService (обёртка над PrismaClient)
packages/
  db/                        @expense-tracker/db — Prisma: схема, миграции, сгенерированный клиент
```

Фронтенд построен по Feature-Sliced Design (`app → views → widgets → features → entities → shared`),
бэкенд — по модулям NestJS на CQRS, где модули общаются только через `contracts` и `common`.
Подробности — в `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md` и
[`.claude/docs/architecture.md`](.claude/docs/architecture.md).

## Модель данных

`packages/db/prisma/schema.prisma`:

| Модель        | Описание                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `User`        | Пользователь: имя, уникальный email, хэш пароля                                                                                          |
| `Category`    | Категория трат пользователя: имя (уникально в пределах пользователя), HEX-цвет, имя иконки lucide                                        |
| `Transaction` | Доход или расход: `amount` (`Decimal(12, 2)`, всегда положительный), `type` (`income`/`expense`), описание, дата операции, категория |

Удаление пользователя каскадом уносит его категории и транзакции. Категорию, на которую
ссылаются транзакции, удалить нельзя (`onDelete: Restrict`) — API отвечает 409.

Назначение каждого поля и ER-диаграмма — в
[`.claude/docs/database.md`](.claude/docs/database.md).

## Основные эндпоинты

Все маршруты живут под префиксом `/api`, интерактивная документация — на `/api/docs` (Swagger).
Кроме `GET /api/health`, `POST /api/auth/register` и `POST /api/auth/login`, требуется заголовок
`Authorization: Bearer <accessToken>`.

| Метод и маршрут                                                        | Что делает                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------- |
| `GET /api/health`                                                       | Проверка работоспособности                    |
| `POST /api/auth/register`                                               | Регистрация, возвращает `accessToken`         |
| `POST /api/auth/login`                                                  | Вход, возвращает `accessToken`                |
| `GET /api/auth/me`                                                      | Текущий пользователь                          |
| `POST` / `GET` / `GET :id` / `PATCH :id` / `DELETE :id` `/api/categories`   | CRUD категорий                                |
| `POST` / `GET :id` / `PATCH :id` / `DELETE :id` `/api/transactions`         | CRUD операций                                  |
| `GET /api/transactions?year=&month=&page=&limit=`                        | Страница операций, сводка и пагинация          |

`year` и `month` необязательны: без них берутся все операции пользователя. `month` без `year`
даёт 400. `page` и `limit` по умолчанию равны 1 и 10, максимум `limit` — 100. Ответ:
`{ items, summary: { income, expense, balance }, pagination: { page, limit, total, totalPages } }`,
причём `summary` и `total` считаются по всему периоду, а не по текущей странице.

Полное описание всех эндпоинтов, DTO и кодов ошибок — в
[`.claude/docs/api.md`](.claude/docs/api.md).

## Полезные команды

Все команды запускаются из корня репозитория.

| Команда                                           | Что делает                                                  |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `npm install`                                      | Установить зависимости всех workspace                        |
| `npm run db:up` / `db:down`                        | PostgreSQL 17 в Docker (порт 5432)                            |
| `npm run db:generate`                              | Prisma Client → `packages/db/src/generated/`                  |
| `npm run db:migrate`                               | `prisma migrate dev`                                          |
| `npm run build -w @expense-tracker/db`             | Клиент → `packages/db/dist/`, обязателен после правки схемы   |
| `npm run db:seed` / `db:studio`                    | Сид и Prisma Studio                                            |
| `npm run dev:api`                                  | NestJS в watch-режиме, http://localhost:3001/api               |
| `npm run dev:web`                                  | Next.js, http://localhost:3000                                 |
| `npm run lint` / `format` / `typecheck` / `build`   | По всему монорепо                                              |
| `npm test -w @expense-tracker/api`                 | Тесты API (Jest + ts-jest; единственный workspace с тестами)   |

Подробное описание архитектуры, конвенций и порядка веток/коммитов — в корневом `CLAUDE.md`,
`apps/api/CLAUDE.md` и `apps/web/CLAUDE.md`. Более полная техническая документация — в
[`.claude/docs/`](.claude/docs/): [`architecture.md`](.claude/docs/architecture.md) (архитектура
и паттерны), [`api.md`](.claude/docs/api.md) (все эндпоинты), [`database.md`](.claude/docs/database.md)
(схема БД) и [`dev-guide.md`](.claude/docs/dev-guide.md) (как добавить модуль, фичу, миграцию).

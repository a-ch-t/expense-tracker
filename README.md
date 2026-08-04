# Expense Tracker

Трекер расходов. Монорепозиторий на npm workspaces.

## Стек

| Слой | Технология | Версия |
| --- | --- | --- |
| Frontend | Next.js (App Router) + React | 16 / 19 |
| Стили | Tailwind CSS + shadcn/ui | 4 |
| Backend | NestJS (Express) | 11 |
| ORM | Prisma + `@prisma/adapter-pg` | 7 |
| БД | PostgreSQL в Docker | 17 |
| Язык | TypeScript | 5.9.3 |

> TypeScript закреплён на 5.9.3, а не на 7.x: `@nestjs/cli` тянет ровно `5.9.3`,
> `ts-jest` объявляет peer `>=4.3 <7`, `typescript-eslint` — `>=4.8.4 <6.1.0`.

## Структура

```
apps/
  web/    @expense-tracker/web   — Next.js, порт 3000
  api/    @expense-tracker/api   — NestJS,  порт 3001
packages/
  db/     @expense-tracker/db    — Prisma: схема, миграции, клиент
```

## Запуск

Зависимости ещё не установлены — на текущем этапе создан только каркас.

```bash
npm install                # установить зависимости всех workspace
cp .env.example .env       # прописать переменные окружения
npm run db:up              # поднять PostgreSQL в Docker
npm run db:generate        # сгенерировать Prisma Client
npm run db:migrate         # применить миграции (после появления моделей)

npm run dev:api            # бэкенд на http://localhost:3001
npm run dev:web            # фронтенд на http://localhost:3000
```

`dev:api` и `dev:web` запускаются в отдельных терминалах: `npm run --workspaces`
выполняет скрипты последовательно и не годится для двух dev-серверов сразу.

## Полезные команды

| Команда | Что делает |
| --- | --- |
| `npm run lint` | ESLint по всему монорепо |
| `npm run format` | Prettier с автоисправлением |
| `npm run build` | Сборка всех пакетов |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Наполнение БД тестовыми данными |
| `npm run db:down` | Остановить PostgreSQL |

## Модель данных

`packages/db/prisma/schema.prisma` пока содержит только `generator` и `datasource`.
Модели (пользователи, категории, транзакции) проектируются отдельной задачей.

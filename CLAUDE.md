# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Состояние проекта

Монорепозиторий с авторизацией, категориями трат и учётом доходов/расходов. Бэкенд — `apps/api`
(NestJS, CQRS, эндпоинты `/api/auth`, `/api/categories`, `/api/transactions`), фронтенд —
`apps/web` (Next.js, Feature-Sliced Design). Модель данных, состав эндпоинтов и остальные детали
бэкенда — в `apps/api/CLAUDE.md`; страницы, состояние фронтенда и его архитектура —
в `apps/web/CLAUDE.md`.

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

Архитектура самого фронтенда (Feature-Sliced Design, слои, авторизация через httpOnly-куку) —
в `apps/web/CLAUDE.md`; архитектура бэкенда (модули на CQRS, `contracts`/`common`, JWT,
`PrismaService`) — в `apps/api/CLAUDE.md`.

## Конвенции

- **TypeScript закреплён на 5.9.3** во всех workspace — это точная версия, которую требует
  `@nestjs/cli`; `ts-jest` и `typescript-eslint` тоже не принимают 7.x. Не поднимать.
- `tsconfig.base.json` включает `strict` и `noUncheckedIndexedAccess`: индексный доступ и
  `process.env['X']` дают `T | undefined` — обрабатывать явно (в коде используется запись
  `process.env['DATABASE_URL']`, а не через точку).
- ESLint — flat config: корневой `eslint.config.mjs` базовый, конфиги в `apps/*` импортируют его и
  дополняют. Неиспользуемые переменные разрешены только с префиксом `_`.
- Prettier: одинарные кавычки, точки с запятой, `printWidth: 100`, `trailingComma: all`.
- Комментарии и описания в коде — на русском, как в существующих файлах.
- Конвенции конкретного workspace (shadcn/ui, цветовые токены, форматирование чисел и дат
  на фронте; структура DTO и модулей на бэкенде) — в `apps/web/CLAUDE.md` и
  `apps/api/CLAUDE.md` соответственно.

## Ветки

Работаем по GitHub Flow: `main` всегда в рабочем состоянии, любая задача живёт в своей ветке.

- **В `main` не коммитим напрямую** — ни код, ни документацию, ни правки в `.claude/`.
  Единственное, что появляется в `main`, — merge-коммит влитой ветки.
- **Ветка на задачу**, от свежего `main`: `git switch main && git switch -c feat-dashboard`.
  Ветка короткая: одна фича — одна ветка, а не «всё, что делалось на неделе».
- **Имя ветки** — `<тип>-<краткое-описание>` латиницей в kebab-case, тип берётся из тех же,
  что у коммитов (`feat-transactions`, `fix-session-redirect`, `docs-branching`). Разделитель —
  дефис, а не слэш: так уже названы ветки в истории репозитория, и такое имя без изменений
  годится в качестве имени каталога для `git worktree`.
- **Отставшую ветку подтягиваем `git merge main`** внутрь ветки, а не ребейзом: на ветке
  бывают чужие коммиты и worktree, а `rebase` переписывает уже существующие хеши.
- **Перед вливанием прогоняем проверки** из корня: `npm run build` (он же пересобирает
  `@expense-tracker/db`, см. «Архитектуру»), затем `npm run lint`, `npm run typecheck` и
  `npm test -w @expense-tracker/api`. Ветка вливается только зелёной.
- **Вливаем merge-коммитом:** `git switch main && git merge --no-ff feat-dashboard`.
  Fast-forward размазал бы фичу по линейной истории, а `--no-ff` оставляет видимой границу:
  по merge-коммитам `worktree-auth-frontend` и `feat-transactions` сразу понятно, каким
  набором коммитов делалась каждая фича.
- **После вливания ветку удаляем** (`git branch -d feat-dashboard`) вместе с её worktree,
  если он создавался.
- **Remote — `git@github.com:a-ch-t/expense-tracker.git`.** Последний шаг — не локальный
  `git merge`, а `git push -u origin <ветка>` и PR в GitHub; всё остальное (ветка от свежего
  `main`, её имя, проверки перед вливанием) остаётся как есть.
- **Перед созданием PR смотрим `git diff main`** (весь диф ветки, а не только последний
  коммит), чтобы описание отражало реальные изменения, а не то, что запомнилось по ходу
  работы. Из дифа описание должно ответить на два вопроса: что реализовано и какие эндпоинты
  добавлены/изменены (метод, путь, для API-веток — коротко по каждому).
- **Заголовок PR** — по Conventional Commits, как заголовок коммита (см. «Коммиты»):
  `<тип>(<область>): <что делает>`, императив, без точки, до 72 символов.

<when_committing>
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
</when_committing>
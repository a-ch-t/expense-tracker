# План: главный экран (web) + пагинация транзакций (api)

## Контекст

API уже умеет всё, что нужно для учёта: авторизацию, категории и транзакции со сводкой
(`{ items, summary }`). Фронт про транзакции и категории не знает вовсе — `/dashboard`
(`apps/web/src/views/dashboard/ui/dashboard-page.tsx`) показывает карточку с именем
пользователя и кнопкой выхода, навигации в приложении нет.

Задача — сделать `/dashboard` настоящим главным экраном: боковое меню с переходами в
«Транзакции» и «Категории», профиль пользователя, сводка доходов/расходов/баланса и список
последних 10 операций с постраничной навигацией. Фронт строится по FSD.

Единственное, чего для этого не хватает в бэкенде, — пагинации: `GET /api/transactions`
отдаёт весь список за период целиком.

### Принятые решения

| Вопрос                   | Решение                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| Пагинация                | В API: `?page=&limit=` (по умолчанию 1 и 10) + `pagination` в ответе        |
| «Транзакции»/«Категории» | Страницы-заглушки «раздел в разработке», как `/terms` и `/privacy`          |
| Сводка                   | Три карточки над списком; берётся из того же ответа, отдельного запроса нет |
| Раскладка                | Сайдбар слева (навигация + профиль + выход), контент справа                 |
| Слой оболочки            | Новый слой FSD `widgets` между `views` и `features`                         |

**Сайдбар пишем сам, без `npx shadcn add sidebar`.** Компонент shadcn тянет за собой sheet,
tooltip, skeleton, separator, провайдер состояния и куку сворачивания — это шесть новых
файлов в `shared/ui` и клиентский рантайм ради статичного меню из двух пунктов. Свой `aside`
на Tailwind рендерится как RSC; клиентским остаётся только подсветка активного пункта.

**Сводка считается за всё время, а не за месяц.** Список — «последние операции» без фильтра
периода, и сводка обязана описывать ту же выборку. Фильтр по месяцу у API уже есть и
подключается отдельной задачей вместе с экраном транзакций.

---

## Шаг 1. Пагинация в API (`apps/api`)

- `transactions/dto/query-transactions.dto.ts` — поля `page` и `limit` рядом с `year`/`month`:
  `@Type(() => Number) @IsInt() @Min(1)`, у `limit` ещё `@Max(100)`. Значения по умолчанию —
  инициализаторами полей (`page: number = 1`), их проставит `transform` глобального
  `ValidationPipe`.
- `transactions/transaction.read-model.ts` — интерфейс `TransactionsPagination`
  (`page`, `limit`, `total`, `totalPages`), `TransactionsPage` дополняется полем `pagination`.
  Изменение аддитивное: существующие потребители ответа не ломаются.
- `transactions/transactions.repository.ts` — `findAllByUser` принимает третьим аргументом
  `{ skip, take }`, добавляется `countByUser(userId, period)`. Оба переиспользуют приватный
  `buildWhere`, индекс `@@index([userId, date])` покрывает и то и другое.
- `transactions/transactions.service.ts` — в `findAll` к текущему `Promise.all` добавляется
  `countByUser`; `skip = (page - 1) * limit`, `totalPages = Math.ceil(total / limit)`.
  **`summarize` остаётся без `skip`/`take`** — сводка описывает весь период, а не страницу.
- `transactions/transactions.service.spec.ts` — в мок репозитория добавляется `countByUser`,
  в `describe('findAll')` кейсы: значения по умолчанию дают `skip: 0, take: 10`; `page=3`
  даёт `skip: 20`; `totalPages` считается от `total` и `limit`; сводка не зависит от страницы.

## Шаг 2. `shared` (`apps/web/src/shared`)

- `config/routes.ts` — `transactions: '/transactions'`, `categories: '/categories'`.
- `api/session-token.ts` (новый) — `getSessionToken()`: `server-only`, читает куку
  `SESSION_COOKIE_NAME`. Нужен потому, что `entities/transaction` не может импортировать
  `entities/session` (соседний слайс запрещён ESLint-ом), а токен нужен обоим.
  `entities/session/api/get-session.ts` переводится на него, чтобы чтение куки осталось
  в одном месте.
- `lib/format.ts` (новый) — `formatMoney` и `formatDate` на `Intl` с локалью `ru-RU`
  и валютой `RUB`.
- `ui/pagination.tsx` (новый) — «Назад / N из M / Вперёд» на `Link` + `buttonVariants`
  из `shared/ui/button`. Ссылки, а не кнопки: страница остаётся серверной, состояние живёт
  в `?page=`.

## Шаг 3. Слайс `entities/transaction`

Публичный `index.ts`, внутри — относительные пути.

- `model/transaction.ts` — зеркало read-моделей API: `TransactionType`, `Category`,
  `Transaction`, `TransactionsSummary`, `TransactionsPagination`, `TransactionsPage`.
  `date`/`createdAt` — строки, как в `entities/session/model/user.ts`: после `JSON.parse`
  дата приезжает строкой ISO.
- `api/get-transactions.ts` — `getTransactions({ page, limit })` поверх `apiFetch`.
  Возвращает **три состояния** по образцу `SessionState`: `ok` / `unauthenticated` (401) /
  `unavailable` (сеть или 5xx, пишется в `console.error`). Без этого страница на любой сбой
  увела бы на `/login`, а proxy по живому `exp` вернул бы обратно — цикл редиректов.
- `ui/transaction-item.tsx` — строка операции: кружок цвета категории с первой буквой,
  описание и название категории, сумма со знаком (`income` — акцентным цветом), дата.
  Имя иконки lucide из `category.icon` пока не используется: динамический реестр иконок
  тянет в бандл весь набор — отдельная задача.
- `ui/transaction-list.tsx` — список строк плюс пустое состояние «Операций пока нет».
- `ui/summary-cards.tsx` — три карточки: доход, расход, баланс.

## Шаг 4. Новый слой `widgets`

`src/widgets/app-sidebar/` — оболочка, общая для главного экрана и обеих заглушек, поэтому
она не может лежать в слайсе `views`.

- `ui/app-sidebar.tsx` (RSC) — бренд, навигация, внизу имя и email пользователя и
  `LogoutButton` из `@/features/auth`. Пользователя принимает пропсом: решение, что делать
  при отсутствии сессии, остаётся у лейаута.
- `ui/nav-links.tsx` (`'use client'`) — `usePathname` для подсветки активного пункта.
- `apps/web/eslint.config.mjs` — блок `src/widgets/**` (нельзя `@/app/**`, `@/views/**`
  и соседние виджеты; в `features`/`entities` только через барель) и запрет `@/widgets/**`
  в блоках `shared`, `entities`, `features`.

Цепочка зависимостей становится `app → views → widgets → features → entities → shared`.

## Шаг 5. Роуты и вёрстка (`apps/web/src/app`, `views`)

- `app/(app)/layout.tsx` (новый) — общая оболочка: `getSession()`, `unauthenticated` →
  `redirect(ROUTES.logout)`, `unavailable` → `Alert` вместо контента, иначе сайдбар + `main`.
  Группа `(app)` на URL не влияет.
- `app/dashboard/page.tsx` переезжает в `app/(app)/dashboard/page.tsx`; добавляются
  `app/(app)/transactions/page.tsx` и `app/(app)/categories/page.tsx` с `metadata`.
- `views/stub/` (новый слайс) — общая карточка «Раздел в разработке» по образцу
  `views/legal/ui/legal-page.tsx`, из неё собираются `TransactionsPage` и `CategoriesPage`.
- `views/dashboard/ui/dashboard-page.tsx` переписывается: принимает `searchParams`
  (в Next 16 это `Promise`), приводит `page` к числу (мусор и значения `< 1` → 1), зовёт
  `getTransactions({ page, limit: 10 })`, рендерит `SummaryCards`, карточку «Последние
  операции» с `TransactionList` и `Pagination` (скрыта при `totalPages <= 1`).
  Проверка сессии из этого файла уходит в лейаут.
- `proxy.ts` — в `matcher` добавляются `'/transactions/:path*'` и `'/categories/:path*'`.
- Перед вёрсткой загрузить скилл `frontend-design`.

## Шаг 6. Документация

- `CLAUDE.md` — «Состояние проекта» (пагинация, главный экран, заглушки разделов),
  слой `widgets` в описании FSD, `?page=&limit=` у `GET /api/transactions`.
- `README.md` — строка про `GET /api/transactions` в таблице эндпоинтов.
- План кладётся в `.claude/plans/dashboard.md` — так хранятся планы предыдущих задач.
- Коммиты в ветке `feat-dashboard` по конвенции: `feat(api): ...` (пагинация),
  `feat(web): ...` (оболочка и сайдбар), `feat(web): ...` (главный экран), `docs: ...`.

---

## Верификация

Автоматическая, из корня:

```bash
npm test -w @expense-tracker/api   # включая новые кейсы пагинации
npm run lint
npm run typecheck
npm run build
```

Ручная (два терминала: `npm run dev:api`, `npm run dev:web`):

1. `npm run db:up`, при пустой базе — `npm run db:seed`; операций нужно больше 10,
   недостающие добить `POST /api/transactions` через curl.
2. `curl -H "Authorization: Bearer $TOKEN" 'http://localhost:3001/api/transactions?page=2&limit=10'`
   — в ответе ровно 10 записей (или остаток), `pagination.total` совпадает с полным
   количеством, `summary` не меняется между страницами.
3. `/dashboard` под залогиненным пользователем: сайдбар с именем, сводка, 10 операций;
   «Вперёд» ведёт на `?page=2` и меняет список; на последней странице «Вперёд» неактивна.
4. Пункты меню открывают `/transactions` и `/categories` с заглушками; сайдбар на них тот же.
5. `/dashboard?page=abc` и `?page=-5` открывают первую страницу, а не падают.
6. При остановленном API `/dashboard` показывает «Сервис недоступен», не уводя на `/login`.
7. Ширина окна ~375px: сайдбар превращается в верхнюю полосу, горизонтальной прокрутки нет.

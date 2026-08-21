# Фронтенд авторизации: логин и регистрация

Дата: 2026-08-10

## Цель

Дать пользователю рабочий цикл авторизации в вебе поверх готового API: регистрация, вход,
защищённая страница и выход. Попутно заложить архитектуру фронтенда по Feature-Sliced Design,
на которую лягут следующие фичи (категории, траты, отчёты).

## Что уже есть

API (`apps/api`) отдаёт:

| Эндпоинт                  | Тело запроса                | Ответ                         |
| ------------------------- | --------------------------- | ----------------------------- |
| `POST /api/auth/register` | `{ name, email, password }` | `201` `{ accessToken, user }` |
| `POST /api/auth/login`    | `{ email, password }`       | `200` `{ accessToken, user }` |
| `GET /api/auth/me`        | заголовок `Authorization`   | `200` `UserReadModel`         |

`UserReadModel` — `{ id, name, email, createdAt }`. Ограничения DTO: `name` от 2 символов,
`email` — валидный email, `password` от 8 символов. Известные ошибки: `409` на занятый email,
`401` на неверную пару email/пароль, `400` от `ValidationPipe` с массивом строк в `message`.

Веб (`apps/web`) — голый каркас Next.js 16 App Router: `layout.tsx`, `page.tsx`, `globals.css`,
`lib/utils.ts`. shadcn/ui настроен в `components.json` (стиль `new-york`, RSC, `baseColor: neutral`,
иконки lucide), но `src/components/ui/` пуст — ни одного компонента не установлено.

## Решения

### Хранение токена — httpOnly cookie через Server Actions

Форма вызывает Server Action, тот идёт в NestJS, получает `accessToken` и кладёт его в httpOnly
cookie через `cookies()` из `next/headers`.

Почему так, а не localStorage: токен недоступен из JS (защита от XSS), работает middleware для
защиты роутов, серверные компоненты могут ходить в API без мигания «загрузка → редирект».

Прямое следствие: **браузер никогда не обращается к NestJS напрямую**. Все запросы к API идут из
серверного кода Next. Поэтому адрес API — серверная переменная окружения `API_URL` без префикса
`NEXT_PUBLIC_`, а CORS-настройка API в этом сценарии не участвует.

### Формы — react-hook-form + zod + компонент form из shadcn/ui

Одна zod-схема на слайс используется и в браузере (через `zodResolver`), и в Server Action.
Клиентская валидация даёт мгновенную обратную связь, серверная — гарантию, что в API не уйдёт
мусор в обход браузера.

### Структура — роутер Next остаётся в `src/app`

`src/app` играет две роли сразу: роутер Next и app-слой FSD (глобальные стили, рут-лейаут).
Файлы `page.tsx` — тонкие реэкспорты из слоя `views`. Остальные слои лежат рядом в `src/`.

Альтернативу — вынести папку роутера в корень `apps/web/app`, оставив `src/app` чистым app-слоем
FSD — отвергли: она каноничнее, но требует переносить существующие файлы и править конфиги ради
косметики.

Слой страниц называется `views`, а не `pages`: имя `pages` в проекте на Next читается как Pages
Router и путает.

### Границы слоёв закрепляются в ESLint

По образцу `apps/api/eslint.config.mjs`, где границы модулей уже держатся на `no-restricted-imports`.
Тот же приём вместо `eslint-plugin-boundaries`: без новой зависимости и в одном стиле с API.

## Структура файлов

```
apps/web/
  components.json                   алиасы переезжают на shared
  src/
    middleware.ts                   защита роутов
    app/                            роутер Next + app-слой FSD
      layout.tsx                    существует, меняется минимально
      globals.css                   существует
      page.tsx                      redirect('/dashboard')
      (auth)/layout.tsx             центрирующий контейнер
      (auth)/login/page.tsx         реэкспорт LoginPage
      (auth)/register/page.tsx      реэкспорт RegisterPage
      dashboard/page.tsx            реэкспорт DashboardPage
    views/
      login/ui/login-page.tsx       + index.ts
      register/ui/register-page.tsx + index.ts
      dashboard/ui/dashboard-page.tsx + index.ts
    features/
      auth/
        api/login.action.ts
        api/register.action.ts
        api/logout.action.ts
        model/login.schema.ts
        model/register.schema.ts
        ui/login-form.tsx
        ui/register-form.tsx
        ui/logout-button.tsx
        index.ts
    entities/
      session/
        api/get-session.ts
        model/user.ts
        index.ts
    shared/
      api/api-client.ts
      api/api-error.ts
      config/env.ts
      config/routes.ts
      config/session-cookie.ts
      lib/utils.ts                  переезжает из src/lib/utils.ts
      ui/                           компоненты shadcn, переезжает из src/components/ui/
```

Правило зависимостей — строго вниз: `app → views → features → entities → shared`. Слайсы одного
слоя друг друга не импортируют. Каждый слайс вне `shared` имеет публичный `index.ts`, и импорт идёт
только через него. `shared` — исключение: в него импортируются напрямую сегменты
(`@/shared/ui/button`), потому что барель на весь слой утянул бы в бандл всё подряд.

Побочные переезды, без которых shadcn будет ставить компоненты мимо FSD: `src/lib/utils.ts` →
`src/shared/lib/utils.ts`, пустой `src/components/ui/` → `src/shared/ui/`, с правкой алиасов в
`components.json` (`ui` → `@/shared/ui`, `lib` → `@/shared/lib`, `utils` → `@/shared/lib/utils`,
`components` → `@/shared`, `hooks` → `@/shared/lib/hooks`). Каталог `src/components/` после
переезда удаляется.

## Компоненты и слои

### `shared/api`

`api-error.ts` — класс `ApiError` с полями `status` и `message`.

`api-client.ts` — функция `apiFetch<T>(path, init): Promise<T>`. Берёт базовый URL из
`shared/config/env`, ставит `Content-Type: application/json`, на не-2xx бросает `ApiError`.
Тело ошибки NestJS — `{ statusCode, message, error }`, где `message` бывает и строкой, и массивом
строк (у `ValidationPipe` — всегда массив); нормализуется в одну строку. Сетевая ошибка
(API не поднят) тоже превращается в `ApiError` со `status: 0`.

`shared/config/env.ts` читает `API_URL` через `process.env['API_URL']` (в проекте включён
`noUncheckedIndexedAccess`) и падает с внятной ошибкой, если переменной нет.

`shared/config/routes.ts` — константы путей (`/login`, `/register`, `/dashboard`), чтобы редиректы
в middleware, экшенах и ссылках не разъезжались.

`shared/config/session-cookie.ts` — имя куки (`access_token`) и её опции: `httpOnly: true`,
`sameSite: 'lax'`, `path: '/'`, `secure` только в production. `maxAge` не задаётся — кука
сессионная, реальный срок жизни определяет сам JWT.

Константы лежат в `shared`, а не в `entities/session`, из-за middleware: он работает в Edge-рантайме,
а импорт из бареля `entities/session` затянул бы туда `next/headers`, который в middleware
недоступен. Имя и опции куки — конфигурация, а не доменная логика, так что место в `shared` для них
честное.

### `entities/session`

`model/user.ts` — тип `User` (`id`, `name`, `email`, `createdAt`), зеркало `UserReadModel` API.

`api/get-session.ts` — `getSession(): Promise<User | null>` в обёртке `cache()`: читает куку, зовёт
`GET /api/auth/me` с `Authorization: Bearer`, на `401` возвращает `null`. Единственное место, где
фронт узнаёт, кто залогинен. Обёртка `cache()` нужна, чтобы несколько серверных компонентов на
одной странице не сделали несколько запросов к `/auth/me`.

### `features/auth`

`model/login.schema.ts` и `model/register.schema.ts` — zod-схемы, повторяющие DTO API один в один,
с русскими сообщениями об ошибках. Поля «повторите пароль» нет: его нет в `RegisterDto`, и поле,
которое никуда не уходит, здесь не нужно.

`api/login.action.ts`, `api/register.action.ts` — Server Actions (`'use server'`). Валидируют вход
своей схемой, зовут API через `apiFetch`, на успех кладут куку и делают `redirect`. Возвращают
`{ error: string, field?: 'email' }` при неудаче — исключения наружу не бросают.

Деталь реализации: `redirect()` в Next работает через специальное исключение, поэтому вызывается
вне `try/catch`, иначе catch проглотит редирект.

`api/logout.action.ts` — удаляет куку и редиректит на `/login`. Токен на стороне API не отзывается:
списка отозванных токенов в NestJS нет, и заводить его в рамках этой задачи не будем.

`ui/login-form.tsx`, `ui/register-form.tsx` — client components на `react-hook-form` +
`zodResolver`, размеченные компонентом `form` из shadcn/ui. Во время отправки кнопка `disabled` и
показывает `Loader2` из lucide; поля не блокируются.

`ui/logout-button.tsx` — кнопка, вызывающая `logout.action`.

### `views`

`login` и `register` — серверные компоненты: `Card` с заголовком, соответствующая форма и ссылка на
парную страницу. `dashboard` — серверный компонент: зовёт `getSession()`, показывает имя и email,
рядом кнопка выхода; при `null` делает `redirect('/login')`.

### `src/middleware.ts`

Лежит именно в `src/`, а не в корне `apps/web`: при наличии каталога `src` Next ищет middleware
только там.

Проверяет `exp` из payload токена, декодируя base64 без верификации подписи. Подпись проверяет
NestJS; middleware решает исключительно навигационную задачу, поэтому ему не нужен ни `JWT_SECRET`
на фронте, ни Edge-совместимая криптобиблиотека вроде `jose`.

Логика:

- нет куки или токен просрочен, путь `/dashboard/*` → редирект на `/login`;
- токен по сроку валиден, путь `/login` или `/register` → редирект на `/dashboard`.

Проверять именно `exp`, а не наличие куки, обязательно: с протухшим токеном middleware пустил бы на
`/dashboard`, страница получила бы `401` и ушла на `/login`, а middleware увидел бы куку и вернул
обратно на `/dashboard` — бесконечный цикл редиректов.

`matcher` покрывает `/login`, `/register`, `/dashboard/:path*`. Корень `/` в matcher не входит: он и
так редиректит на `/dashboard`, где middleware сработает.

## Обработка ошибок

| Что случилось           | Что видит пользователь                                    |
| ----------------------- | --------------------------------------------------------- |
| `401` на логине         | «Неверный email или пароль» — сообщение из API, в `Alert` |
| `409` на регистрации    | Ошибка на поле email через `setError`, а не общим алертом |
| `400` (рассинхрон схем) | Сообщение из API в `Alert`                                |
| `5xx` или API не поднят | «Сервис недоступен, попробуйте позже» — своё сообщение    |

Разделение такое: `Alert` — для ошибок про запрос целиком, `setError` на поле — когда виновато
конкретное поле. Занятый email — второй случай.

## Внешний вид

Общий лейаут группы `(auth)`: карточка shadcn по центру экрана, ширина до ~400px, обе страницы
выглядят одинаково.

```
┌─────────────────────────────────────────┐
│         ┌─────────────────────┐         │
│         │  Expense Tracker    │         │
│         │  Вход в аккаунт     │         │
│         │  Email              │         │
│         │  [_______________]  │         │
│         │  Пароль             │         │
│         │  [_______________]  │         │
│         │  [     Войти     ]  │         │
│         │  Нет аккаунта?      │         │
│         │  Зарегистрироваться │         │
│         └─────────────────────┘         │
└─────────────────────────────────────────┘
```

Компоненты shadcn — ровно шесть: `card`, `form`, `input`, `label`, `button`, `alert`. Тост-уведомлений
нет: все сообщения показываются на месте, в форме.

## Зависимости и конфигурация

Новые зависимости `apps/web`: `react-hook-form`, `zod`, `@hookform/resolvers`, плюс
`@radix-ui/*`-пакеты, которые притянет `npx shadcn@latest add`.

Новые переменные в корневом `.env` и `.env.example`:

- `API_URL=http://localhost:3001/api` — адрес NestJS для серверного кода Next.

Изменение существующей переменной: `JWT_EXPIRES_IN` поднимается с `15m` до `7d`. Refresh-токена в
API нет, и с пятнадцатью минутами пользователя выкидывает из сессии посреди работы. Полноценный
refresh-flow — отдельная задача, в этот объём не входит.

Next.js по умолчанию читает `.env` из корня приложения, а он лежит в корне монорепозитория —
`next.config.ts` нужно научить читать `../../.env`, как это уже сделано в `AppModule` для API и в
`prisma.config.ts` для Prisma.

`apps/web/eslint.config.mjs` дополняется блоками `no-restricted-imports`, запрещающими импорты вверх
по слоям и в обход публичных `index.ts` слайсов.

`CLAUDE.md` дополняется разделом про FSD: карта слоёв, правило зависимостей, правило публичных
барелей, где живут алиасы shadcn.

## Что не входит

- Тесты на фронте: раннера в `apps/web` нет, поднимать его — отдельная задача.
- Refresh-токены и отзыв токенов на стороне API.
- Восстановление пароля, подтверждение email, OAuth.
- Любые страницы категорий и трат.

## Как проверяется

Вручную, при поднятых `dev:api` и `dev:web`:

1. Регистрация нового пользователя → попадаем на `/dashboard`, видим своё имя.
2. Выход → попадаем на `/login`.
3. Вход тем же пользователем → снова `/dashboard`.
4. Вход с неверным паролем → «Неверный email или пароль» в `Alert`.
5. Регистрация на занятый email → ошибка под полем email.
6. Заход на `/dashboard` без куки → редирект на `/login`.
7. Заход на `/login` с валидной кукой → редирект на `/dashboard`.
8. `npm run lint`, `npm run typecheck`, `npm run build` проходят по всему монорепо.

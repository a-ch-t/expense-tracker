# Авторизация в API: модули `users` и `auth` через CQRS

## Контекст

В `apps/api` сейчас только `AppController` с `GET /api/health` и `PrismaService`. В
`schema.prisma` нет ни одной модели. Нужен фундамент авторизации: хранение пользователей
(имя, email, хэш пароля) и вход/регистрация по JWT.

Ключевое ограничение — `auth` и `users` не должны знать друг о друге. Поэтому вводится третий,
нейтральный слой `contracts`: там живут классы команд, запросов и read-моделей. `users`
**реализует** эти контракты (регистрирует хендлеры), `auth` **вызывает** их через `CommandBus` /
`QueryBus`. Ни один модуль не импортирует другой — только `contracts`.

Решения, принятые с пользователем: общий слой `contracts`; только access-токен (без refresh);
`bcryptjs`; в объём входят `JwtAuthGuard` + `GET /api/auth/me`. Unit-тесты, seed и UI —
вне объёма.

## Чек-лист задач

### Подготовка

- [x] Добавить в `apps/api/package.json` → `dependencies`: `@nestjs/cqrs` `^11.0.3`,
      `@nestjs/jwt` `^11.0.0`, `bcryptjs` `^3.0.2`
- [x] Выполнить `npm install` из корня (`node_modules` сейчас отсутствует)
- [x] Добавить `JWT_SECRET` и `JWT_EXPIRES_IN=15m` в `.env.example` и `.env`

### База данных

- [x] Добавить модель `User` в `packages/db/prisma/schema.prisma`, убрать комментарий-заглушку
- [x] `npm run db:up`
- [x] `npm run db:generate`
- [x] `npm run db:migrate`

### Слой контрактов (`apps/api/src/contracts/users/`)

- [x] `user.read-model.ts` — `UserReadModel`, `UserCredentials`
- [x] `create-user.command.ts` — `CreateUserCommand extends Command<UserReadModel>`
- [x] `get-user-by-email.query.ts` — `GetUserByEmailQuery extends Query<UserCredentials | null>`
- [x] `get-user-by-id.query.ts` — `GetUserByIdQuery extends Query<UserReadModel | null>`
- [x] `index.ts` — реэкспорт (типы через `export type`, включён `isolatedModules`)

### Модуль `users` (`apps/api/src/users/`)

- [x] `users.repository.ts` — `PrismaService`, методы `create` / `findByEmail` / `findById`,
      маппер `toReadModel`
- [x] `handlers/create-user.handler.ts` — нормализация email, `P2002` → `ConflictException`
- [x] `handlers/get-user-by-email.handler.ts`
- [x] `handlers/get-user-by-id.handler.ts`
- [x] `users.module.ts` — регистрация провайдеров, ничего не экспортирует

### Модуль `auth` (`apps/api/src/auth/`)

- [x] `dto/register.dto.ts`, `dto/login.dto.ts` — классы с `class-validator`
- [x] `types/jwt-payload.ts`
- [x] `auth.service.ts` — `register`, `login`, приватный `issueToken`
- [x] `guards/jwt-auth.guard.ts`
- [x] `decorators/current-user.decorator.ts`
- [x] `auth.controller.ts` — `POST register`, `POST login`, `GET me`
- [x] `auth.module.ts` — `JwtModule.registerAsync` с `ConfigService`

### Подключение

- [x] `app.module.ts` — добавить `CqrsModule.forRoot()`, `UsersModule`, `AuthModule`
- [x] `apps/api/eslint.config.mjs` — правила `no-restricted-imports` между `auth` и `users`
- [x] `CLAUDE.md` — обновить «Состояние проекта» и «Архитектуру»

### Проверка

- [x] `npm run typecheck && npm run lint` — без ошибок (`typecheck` чист по всем workspace;
      `lint -w @expense-tracker/api` и `-w @expense-tracker/db` чисты; корневой `npm run lint`
      падает из-за предсуществующего краша ESLint 10 в `apps/web` — circular JSON в
      `eslint-config-next`/`@eslint/eslintrc`, никак не связано с auth и не затронуто этим планом)
- [x] Ручная проверка всех сценариев из раздела «Проверка» ниже

---

## Разделение ответственности

- **`contracts/users`** — публичный API модуля пользователей. Только типы и классы команд/запросов,
  никакой логики и никаких зависимостей от Prisma/Nest-провайдеров.
- **`users`** — единственный владелец таблицы `User`. Работает с `PrismaService`, отдаёт наружу
  read-модели. Про пароли в открытом виде и про JWT не знает ничего.
- **`auth`** — владеет `bcryptjs` и `JwtService`. Хеширует пароль **до** отправки
  `CreateUserCommand` (сырой пароль не ходит по шине), сверяет хэш при логине, выпускает токен.

## Шаг 1. Зависимости

В `apps/api/package.json` добавить в `dependencies`:

- `@nestjs/cqrs` `^11.0.3`
- `@nestjs/jwt` `^11.0.0`
- `bcryptjs` `^3.0.2` (чистый JS, собственные типы — `@types/bcryptjs` не нужен)

Затем из корня: `npm install` (сейчас `node_modules` отсутствует вообще).

## Шаг 2. Модель в Prisma

`packages/db/prisma/schema.prisma` — добавить модель (комментарий-заглушку про модели заменить):

```prisma
model User {
  id           String   @id @default(uuid(7))
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Уникальность `email` обеспечивает БД — обработчик ловит `P2002` и превращает в `409`.

После правки обязательно: `npm run db:up`, `npm run db:generate`, `npm run db:migrate`
(без генерации импорт `./generated/client` не резолвится и `typecheck` падает — см. CLAUDE.md).

## Шаг 3. Слой контрактов

Новый каталог `apps/api/src/contracts/users/`:

| Файл | Содержимое |
| --- | --- |
| `user.read-model.ts` | `UserReadModel` = `{ id, name, email, createdAt }`; `UserCredentials` = `UserReadModel & { passwordHash }` |
| `create-user.command.ts` | `CreateUserCommand extends Command<UserReadModel>` — поля `name`, `email`, `passwordHash` |
| `get-user-by-email.query.ts` | `GetUserByEmailQuery extends Query<UserCredentials \| null>` — поле `email` |
| `get-user-by-id.query.ts` | `GetUserByIdQuery extends Query<UserReadModel \| null>` — поле `id` |
| `index.ts` | Реэкспорт. Из-за `isolatedModules: true` типы реэкспортировать через `export type` |

Базовые классы `Command<T>` / `Query<T>` из `@nestjs/cqrs` v11 дают вывод типа результата:
`commandBus.execute(new CreateUserCommand(...))` возвращает `Promise<UserReadModel>` без ручных
дженериков. В конструкторах вызывать `super()`.

Два отдельных запроса нужны намеренно: `UserCredentials` с хэшем отдаётся только по email (для
логина), а `GET /me` работает с `UserReadModel`, куда хэш физически не попадает.

## Шаг 4. Модуль `users`

`apps/api/src/users/`:

- `users.repository.ts` — инжектит `PrismaService` (он `@Global`, импорт модуля не нужен),
  методы `create`, `findByEmail`, `findById`. Здесь же приватный маппер `toReadModel`,
  который явно перечисляет поля и тем самым отсекает `passwordHash`.
- `handlers/create-user.handler.ts` — `@CommandHandler(CreateUserCommand)`. Нормализует email
  (`trim().toLowerCase()`), ловит `PrismaClientKnownRequestError` с `code === 'P2002'` →
  `ConflictException('Пользователь с таким email уже существует')`.
- `handlers/get-user-by-email.handler.ts`, `handlers/get-user-by-id.handler.ts` —
  `@QueryHandler(...)`, возвращают `null`, если не найдено.
- `users.module.ts` — регистрирует репозиторий и три хендлера в `providers`. **Ничего не
  экспортирует** — снаружи модуль доступен только через шину.

## Шаг 5. Модуль `auth`

`apps/api/src/auth/`:

- `dto/register.dto.ts` — `name` (`@IsString`, `@MinLength(2)`), `email` (`@IsEmail`),
  `password` (`@IsString`, `@MinLength(8)`).
- `dto/login.dto.ts` — `email`, `password`.
  DTO обязаны быть классами с декораторами: глобальный `ValidationPipe` в `main.ts` включает
  `whitelist + forbidNonWhitelisted`, иначе лишние поля дадут 400.
- `types/jwt-payload.ts` — `{ sub: string; email: string }`.
- `auth.service.ts`:
  - `register(dto)` → `bcrypt.hash(password, 10)` → `commandBus.execute(new CreateUserCommand(...))`
    → подписать токен. Конфликт email прилетит из хендлера как `ConflictException`.
  - `login(dto)` → `queryBus.execute(new GetUserByEmailQuery(email))`. Если пользователя нет —
    всё равно выполнить `bcrypt.compare` с фиктивным хэшем, чтобы не было тайминг-утечки, и
    бросить одинаковый `UnauthorizedException('Неверный email или пароль')` в обоих случаях
    (не различать «нет пользователя» и «неверный пароль»).
  - Приватный `issueToken(user)` → `{ accessToken, user }`.
- `guards/jwt-auth.guard.ts` — реализует `CanActivate`, достаёт Bearer из `Authorization`,
  `jwtService.verifyAsync`, кладёт payload в `request.user`, иначе `UnauthorizedException`.
  Регистрируется точечно через `@UseGuards(JwtAuthGuard)`, **не** глобально через `APP_GUARD` —
  иначе `/api/health`, `register` и `login` тоже закроются.
- `decorators/current-user.decorator.ts` — `createParamDecorator`, отдаёт `request.user` как
  `JwtPayload`.
- `auth.controller.ts` — `@Controller('auth')`:
  - `POST register` → `{ accessToken, user }`
  - `POST login` → `{ accessToken, user }`
  - `GET me` под `@UseGuards(JwtAuthGuard)` → `queryBus.execute(new GetUserByIdQuery(payload.sub))`;
    если `null` (пользователь удалён, токен ещё жив) → `UnauthorizedException`.
- `auth.module.ts` — `JwtModule.registerAsync` с `ConfigService`:
  `secret: config.getOrThrow('JWT_SECRET')`, `signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') ?? '15m' }`.
  `JwtModule` регистрировать **локально в `AuthModule`**, не через `global: true` — секрет нужен
  только здесь.

## Шаг 6. Подключение и конфигурация

- `apps/api/src/app.module.ts` — добавить в `imports`: `CqrsModule.forRoot()` (обязателен в корне
  для v11), `UsersModule`, `AuthModule`.
- `.env.example` и `.env` — добавить `JWT_SECRET` и `JWT_EXPIRES_IN=15m`.
  (Файл может быть недоступен агенту для записи — тогда сообщить пользователю точные строки,
  чтобы он добавил сам; без `JWT_SECRET` приложение не поднимется из-за `getOrThrow`.)

## Шаг 7. Запрет прямых импортов между модулями

В `apps/api/eslint.config.mjs` добавить `no-restricted-imports` — чтобы правило «без прямых
импортов» держалось само, а не на дисциплине:

```js
{
  files: ['src/auth/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['**/users/**'] }] },
},
{
  files: ['src/users/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['**/auth/**'] }] },
},
```

## Шаг 8. Обновить `CLAUDE.md`

Раздел «Состояние проекта» устареет: появятся модели в `schema.prisma` и эндпоинты авторизации.
В «Архитектуру» добавить абзац про слой `contracts` и правило общения модулей через шину.

## Проверка

```bash
npm install
npm run db:up && npm run db:generate && npm run db:migrate
npm run typecheck && npm run lint
npm run dev:api
```

Затем вручную, по порядку:

1. `POST http://localhost:3001/api/auth/register` с `{name, email, password}` → `201`,
   в ответе `accessToken` и `user` **без** `passwordHash`.
2. Повтор того же запроса → `409`.
3. `POST /api/auth/login` с верным паролем → `200` + токен; с неверным → `401`.
4. `register` с `password` короче 8 символов или с лишним полем → `400` (работа `ValidationPipe`).
5. `GET /api/auth/me` с `Authorization: Bearer <token>` → `200` + профиль;
   без заголовка и с испорченным токеном → `401`.
6. `GET /api/health` по-прежнему `200` без токена.
7. `npm run db:studio` — убедиться, что в `passwordHash` лежит bcrypt-хэш (`$2b$10$...`),
   а не пароль.

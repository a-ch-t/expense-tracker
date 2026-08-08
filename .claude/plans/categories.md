# Модуль категорий трат (Category)

## Контекст

В проекте уже есть авторизация (`users` + `auth` на CQRS), но нет ни одной доменной сущности,
кроме `User`. Категории — базовый справочник, без которого нельзя начать учёт трат: каждая
будущая запись расхода будет ссылаться на категорию.

Нужно: модель `Category` (id, name, color, icon, userId → FK к User), сервис с CRUD-методами,
контроллер под `JwtAuthGuard`, валидация через `class-validator`, обращение к домену `User`
только через CQRS.

**Ключевая помеха, обнаруженная при разборе кода:** `JwtAuthGuard` объявлен в `providers`
модуля `AuthModule`, `JwtModule.registerAsync` зарегистрирован там же локально, а `AuthModule`
ничего не экспортирует (`apps/api/src/auth/auth.module.ts:9-28`). Поэтому `@UseGuards(JwtAuthGuard)`
в новом контроллере упадёт на DI: Nest не найдёт `JwtService`. Решение — вынести JWT-инфраструктуру
в общий слой `src/common/auth/`, по аналогии с уже существующим приёмом `src/contracts/users/`.

Принятые решения: сервис работает с Prisma напрямую (без собственных CQRS-контрактов), к домену
`User` обращается через `QueryBus` + существующий `GetUserByIdQuery`; чужая категория → 404;
модель получает `createdAt`/`updatedAt`, `@@unique([userId, name])` и `onDelete: Cascade`;
валидация color/icon строгая; пишем первые в проекте unit-тесты сервиса.

---

## Чек-лист

### Шаг 1. Схема БД и миграция

- [ ] `packages/db/prisma/schema.prisma`: добавить `categories Category[]` в модель `User`
- [ ] `packages/db/prisma/schema.prisma`: добавить модель `Category`
- [ ] `npm run db:up` (если Postgres не поднят) и `npm run db:migrate` — имя миграции `add_category`
- [ ] `npm run build -w @expense-tracker/db` — иначе типы `Category` не появятся в API

### Шаг 2. Вынести JWT-инфраструктуру в `src/common/auth/`

- [ ] Перенести `auth/types/jwt-payload.ts` → `common/auth/jwt-payload.ts`
- [ ] Перенести `auth/guards/jwt-auth.guard.ts` → `common/auth/jwt-auth.guard.ts`
- [ ] Перенести `auth/decorators/current-user.decorator.ts` → `common/auth/current-user.decorator.ts`
- [ ] Создать `common/auth/auth-core.module.ts` (`JwtModule` + `JwtAuthGuard`, экспортирует оба)
- [ ] Создать барель `common/auth/index.ts`
- [ ] Обновить импорты в `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`
- [ ] Удалить пустые каталоги `auth/types/`, `auth/guards/`, `auth/decorators/`
- [ ] **Промежуточная проверка:** `typecheck` + `lint` + regress авторизации через curl

### Шаг 3. Модуль `apps/api/src/categories/`

- [ ] `category.read-model.ts`
- [ ] `dto/create-category.dto.ts`
- [ ] `dto/update-category.dto.ts`
- [ ] `categories.repository.ts`
- [ ] `categories.service.ts`
- [ ] `categories.controller.ts`
- [ ] `categories.module.ts`

### Шаги 4–7. Интеграция

- [ ] Проверка владельца через `QueryBus` + `GetUserByIdQuery` в `CategoriesService.create`
- [ ] Зарегистрировать `CategoriesModule` в `app.module.ts`
- [ ] Расширить `no-restricted-imports` в `apps/api/eslint.config.mjs` (три блока)

### Шаги 8–9. Тесты и документация

- [ ] `categories.service.spec.ts` — первый spec в проекте
- [ ] Обновить `CLAUDE.md` («Состояние проекта» + «Архитектура»)

### Верификация

- [ ] `npm run typecheck && npm run lint && npm run format:check`
- [ ] `npm test -w @expense-tracker/api`
- [ ] `npm run build`
- [ ] Ручная проверка эндпоинтов через curl (таблица кодов ниже)
- [ ] Проверка каскадного удаления категорий вместе с пользователем

---

## Шаг 1. Схема БД и миграция

`packages/db/prisma/schema.prisma` — добавить обратную связь в `User` и новую модель.
Соглашения репозитория: `@@map`/`@map` не используются, id — `uuid(7)`.

```prisma
model User {
  // ...существующие поля без изменений
  categories   Category[]
}

/// Категория трат. Принадлежит ровно одному пользователю.
model Category {
  id        String   @id @default(uuid(7))
  name      String
  /// HEX-цвет вида #rrggbb
  color     String
  /// Имя иконки lucide в kebab-case, например shopping-cart
  icon      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Имя уникально в пределах пользователя. Этот же индекс покрывает выборку всех
  // категорий пользователя (userId — ведущая колонка), отдельный @@index не нужен.
  @@unique([userId, name])
}
```

Затем:

```bash
npm run db:up            # если Postgres не поднят
npm run db:migrate       # имя миграции: add_category
npm run build -w @expense-tracker/db
```

Последняя команда обязательна: `@expense-tracker/db` резолвится через `main: ./dist`, и без
пересборки типы `Category` / `prisma.category` в `apps/api` не появятся.

---

## Шаг 2. Вынести JWT-инфраструктуру в `src/common/auth/`

Перенос файлов **без изменения их содержимого** (кроме относительных импортов внутри):

| Откуда                                                   | Куда                                                 |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `apps/api/src/auth/types/jwt-payload.ts`                 | `apps/api/src/common/auth/jwt-payload.ts`            |
| `apps/api/src/auth/guards/jwt-auth.guard.ts`             | `apps/api/src/common/auth/jwt-auth.guard.ts`         |
| `apps/api/src/auth/decorators/current-user.decorator.ts` | `apps/api/src/common/auth/current-user.decorator.ts` |

Каталоги `auth/types/`, `auth/guards/`, `auth/decorators/` после переноса удалить; `auth/dto/` остаётся.

Новый `apps/api/src/common/auth/auth-core.module.ts` — забирает блок `JwtModule.registerAsync`
целиком из `auth.module.ts:10-24` (вместе с комментарием про `SignOptions`):

```ts
// Инфраструктура JWT: конфигурация подписи и гард. Бизнес-логики здесь нет —
// ни bcrypt, ни знания о пользователях. Не глобальный: модули импортируют явно.
@Module({
  imports: [JwtModule.registerAsync({/* перенести как есть */})],
  providers: [JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard], // JwtModule нужен AuthService для подписи токена
})
export class AuthCoreModule {}
```

Барель `apps/api/src/common/auth/index.ts` — единственная разрешённая точка входа (см. шаг 7):

```ts
export type { JwtPayload } from './jwt-payload';
export type { AuthenticatedRequest } from './jwt-auth.guard';
export { JwtAuthGuard } from './jwt-auth.guard';
export { CurrentUser } from './current-user.decorator';
export { AuthCoreModule } from './auth-core.module';
```

Правки существующих файлов (ссылок на перенесённое всего 8, все внутри `src/auth/`):

- `auth.controller.ts:7-9` — три импорта схлопнуть в
  `import { CurrentUser, JwtAuthGuard, type JwtPayload } from '../common/auth';`
- `auth.service.ts:13` — `import type { JwtPayload } from '../common/auth';`
- `auth.module.ts` — сводится к `imports: [AuthCoreModule]`, `controllers: [AuthController]`,
  `providers: [AuthService]`; импорты `ConfigModule`/`JwtModule`/`SignOptions`/`JwtAuthGuard` уходят.

**Промежуточная проверка до написания нового кода:** `npm run typecheck && npm run lint`,
затем `npm run dev:api` и curl по `register`/`login`/`me` — регресс авторизации ловим здесь.

---

## Шаг 3. Модуль `apps/api/src/categories/`

Слои копируют связку `users`: репозиторий — единственный владелец таблицы с приватным
`toReadModel`, сервис — бизнес-правила и маппинг ошибок Prisma, контроллер — только HTTP.

```
categories.module.ts
categories.controller.ts
categories.service.ts
categories.repository.ts
category.read-model.ts
dto/create-category.dto.ts
dto/update-category.dto.ts
categories.service.spec.ts
```

**`category.read-model.ts`** — `{ id, name, color, icon, createdAt }`. `userId` наружу не отдаём:
он всегда равен текущему пользователю. Контракты в `src/contracts/categories/` пока не создаём —
второго потребителя нет (появятся вместе с модулем `expenses`).

**`dto/create-category.dto.ts`** — поля с `!` (в `apps/api/tsconfig.json` выключен
`strictPropertyInitialization`), сообщения об ошибках на русском:

```ts
@IsString() @MinLength(1) @MaxLength(50)                     name!: string;
@Matches(/^#[0-9a-fA-F]{6}$/, { message: '...#RRGGBB' })     color!: string;   // #RGB не принимаем
@IsString() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(50)  icon!: string;
```

Поля `userId` в DTO нет и быть не должно: глобальный `ValidationPipe` с `forbidNonWhitelisted`
(`apps/api/src/main.ts`) вернёт 400 на попытку его прислать.

**`dto/update-category.dto.ts`** — те же три поля с `@IsOptional()` и `?`.
`PartialType` использовать нельзя: `@nestjs/mapped-types` и `@nestjs/swagger` в зависимостях нет.

**`categories.repository.ts`** — инжектит `PrismaService` (доступен без импорта, `PrismaModule`
помечен `@Global`). Методы: `create(userId, data)`, `findAllByUser(userId)` (`orderBy: createdAt asc`),
`findByIdForUser(id, userId)` (`findFirst`, т.к. `userId` — условие владения, а не уникальный ключ),
`update(id, userId, data)`, `remove(id, userId)`. В `update`/`delete` использовать
`where: { id, userId }` — extendedWhereUnique в Prisma 7 это позволяет, чужая строка не найдётся
и Prisma бросит P2025. Запасной вариант, если типы не сойдутся после генерации: `updateMany`/
`deleteMany` с проверкой `count === 0 → NotFoundException`.

**`categories.service.ts`** — методы `create`, `findAll`, `findOne`, `update`, `remove`,
все принимают `userId` первым аргументом. Маппинг ошибок Prisma по образцу
`users/handlers/create-user.handler.ts`:

| Код    | Ответ                 | Когда                                           |
| ------ | --------------------- | ----------------------------------------------- |
| P2002  | 409 Conflict          | дубль имени у пользователя                      |
| P2025  | 404 Not Found         | update/delete не нашли пару (id, userId)        |
| P2003  | 401 Unauthorized      | пользователя удалили между проверкой и вставкой |
| прочее | пробрасываем как есть |                                                 |

`findOne` при `null` из репозитория бросает `NotFoundException` — с комментарием, что чужая
категория намеренно неотличима от несуществующей, чтобы не подтверждать чужие id.

Нормализация перед записью: `name.trim()`, `color.toLowerCase()`.

**`categories.module.ts`** — `imports: [AuthCoreModule]`, `controllers: [CategoriesController]`,
`providers: [CategoriesService, CategoriesRepository]`, ничего не экспортирует.
`CommandBus`/`QueryBus` доступны благодаря `CqrsModule.forRoot()` в `AppModule`.

---

## Шаг 4. Взаимодействие с доменом User через CQRS

Новые контракты не нужны — переиспользуем существующий `GetUserByIdQuery`
(`apps/api/src/contracts/users/get-user-by-id.query.ts`).

В `CategoriesService.create` перед вставкой проверяем владельца:

```ts
import { GetUserByIdQuery, type UserReadModel } from '../contracts/users'; // строго барель!

const owner = await this.queryBus.execute<GetUserByIdQuery, UserReadModel | null>(
  new GetUserByIdQuery(userId),
);
if (!owner) {
  // Токен ещё валиден (TTL 15 минут), но пользователя удалили — как в GET /api/auth/me
  throw new UnauthorizedException('Пользователь не найден');
}
```

Без этой проверки мы бы отдавали «сырой» P2003 вместо внятного ответа.

В `findAll`/`findOne`/`update`/`remove` проверку **не** делаем: владение уже гарантировано
фильтром `where: { userId }`, лишний запрос к БД на каждый CRUD не нужен.

---

## Шаг 5. Контроллер и эндпоинты

`@Controller('categories')` + `@UseGuards(JwtAuthGuard)` на весь класс. `userId` берётся только
из `@CurrentUser() user: JwtPayload` → `user.sub`. Импорт — `from '../common/auth'`.
Для `:id` — `new ParseUUIDPipe({ version: '7' })` (id генерятся как `uuid(7)`).

Глобальный префикс `api` задан в `main.ts`.

| Метод  | Путь                  | Тело                | Успех             | Ошибки             |
| ------ | --------------------- | ------------------- | ----------------- | ------------------ |
| POST   | `/api/categories`     | `CreateCategoryDto` | 201 + read-модель | 400, 401, 409      |
| GET    | `/api/categories`     | —                   | 200 + массив      | 401                |
| GET    | `/api/categories/:id` | —                   | 200 + read-модель | 400, 401, 404      |
| PATCH  | `/api/categories/:id` | `UpdateCategoryDto` | 200 + read-модель | 400, 401, 404, 409 |
| DELETE | `/api/categories/:id` | —                   | 204, пустое тело  | 400, 401, 404      |

`PATCH`, а не `PUT` — обновление частичное. У POST 201 по умолчанию, `@HttpCode` не нужен;
у DELETE — `@HttpCode(HttpStatus.NO_CONTENT)`.

---

## Шаг 6. Регистрация модуля

`apps/api/src/app.module.ts` — добавить `CategoriesModule` в `imports` после `AuthModule`.
`AuthCoreModule` в `AppModule` **не** регистрируем: его импортируют те модули, которым он нужен.

---

## Шаг 7. ESLint

`apps/api/eslint.config.mjs` — расширить существующие два блока и добавить третий:

```js
{ files: ['src/auth/**/*.ts'],       patterns: ['**/users/**', '**/categories/**'] },
{ files: ['src/users/**/*.ts'],      patterns: ['**/auth/**', '**/categories/**'] },
{ files: ['src/categories/**/*.ts'], patterns: ['**/users/**', '**/auth/**'] },
```

**Ловушка, которую обязан знать реализующий:** правило матчит сырую строку импорта. Барель
`'../contracts/users'` проходит, а `'../contracts/users/get-user-by-id.query'` и
`'../contracts/users/index'` — падают. То же для `'../common/auth'` vs `'../common/auth/jwt-auth.guard'`.
Значит `categories` импортирует **только** `'../contracts/users'` и `'../common/auth'`, без хвостов.
Glob `src/auth/**` не матчит `src/common/auth/**`, поэтому перенос гарда правило не ломает,
а относительные `./jwt-auth.guard` внутри `common/auth` под запрет не попадают.

---

## Шаг 8. Тесты

`apps/api/src/categories/categories.service.spec.ts` — первый spec в проекте (Jest настроен
инлайном в `apps/api/package.json`, `rootDir: src`; `tsconfig.build.json` исключает `*.spec.ts`).
`Test.createTestingModule` с моками `CategoriesRepository` и `QueryBus`, БД не поднимаем.
Ошибки Prisma создавать как `new Prisma.PrismaClientKnownRequestError('mock', { code, clientVersion: 'test' })`.

Кейсы:

- `create`: обращается к `QueryBus` с `GetUserByIdQuery`; пользователь не найден → 401 и репозиторий
  не вызван; в репозиторий уходит `userId` из аргумента, `name` обрезан, `color` в нижнем регистре;
  P2002 → 409; P2003 → 401; неизвестная ошибка пробрасывается.
- `findAll`: вызов `findAllByUser` ровно с переданным `userId`.
- `findOne`: `null` → `NotFoundException` (кейс «чужая категория»); найдено → read-модель.
- `update`: в `data` попадают только переданные поля; P2025 → 404; P2002 → 409; `userId` передан.
- `remove`: P2025 → 404; успешный путь возвращает `undefined`.

---

## Шаг 9. Документация

Обновить `CLAUDE.md`: раздел «Состояние проекта» (появились `Category` и `/api/categories`)
и «Архитектуру» — общий слой `common/auth` с `AuthCoreModule` и правило «импортировать только барели
общих слоёв».

---

## Верификация

```bash
npm run db:migrate
npm run build -w @expense-tracker/db
npm run typecheck && npm run lint && npm run format:check
npm test -w @expense-tracker/api
npm run build
npm run dev:api
```

Ручная проверка (в отдельном терминале):

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"a@b.co","password":"password123"}' | jq -r .accessToken)

curl -i http://localhost:3001/api/categories                                    # 401 без токена
curl -s -X POST http://localhost:3001/api/categories -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Еда","color":"#FF8800","icon":"shopping-cart"}'                  # 201
# повтор того же name                                                          → 409
# {"color":"#FFF"}                                                             → 400 (короткий hex)
# {"...","userId":"..."}                                                       → 400 (forbidNonWhitelisted)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/categories  # 200, только свои
curl -i -X PATCH .../categories/<чужой-id> -H "Authorization: Bearer $TOKEN" -d '{"name":"hack"}'  # 404
curl -i -X DELETE .../categories/<свой-id> -H "Authorization: Bearer $TOKEN"    # 204
curl -i .../categories/not-a-uuid -H "Authorization: Bearer $TOKEN"             # 400
```

Отдельно: удалить пользователя в Prisma Studio → его категории исчезают (проверка каскада).
Регресс авторизации: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
должны работать как раньше после переноса гарда.

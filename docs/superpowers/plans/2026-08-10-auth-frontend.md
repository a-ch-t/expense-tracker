# Фронтенд авторизации: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать рабочий цикл авторизации в вебе — регистрация, вход, защищённая страница, выход — и заложить структуру фронтенда по Feature-Sliced Design.

**Architecture:** Токен живёт в httpOnly cookie, которую ставит Server Action; браузер в NestJS напрямую не ходит вообще. Страницы собираются из слоёв FSD (`app → views → features → entities → shared`), границы слоёв закреплены правилами `no-restricted-imports`. Навигацию разруливает middleware, проверяя срок жизни токена без верификации подписи.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9.3, Tailwind 4, shadcn/ui (new-york), react-hook-form, zod 4, @hookform/resolvers.

**Спека:** `docs/superpowers/specs/2026-08-10-auth-frontend-design.md`

## Global Constraints

- TypeScript закреплён на **5.9.3**, поднимать нельзя.
- В `tsconfig.base.json` включены `strict` и `noUncheckedIndexedAccess`: переменные окружения читать как `process.env['API_URL']`, индексный доступ обрабатывать явно.
- Prettier: одинарные кавычки, точки с запятой, `printWidth: 100`, `trailingComma: all`.
- Неиспользуемые переменные разрешены только с префиксом `_`.
- Комментарии, тексты интерфейса и сообщения об ошибках — на русском.
- Тестов на фронте нет: раннера в `apps/web` не существует, и поднимать его эта задача не должна. **Поэтому вместо цикла TDD каждая задача проверяется через `typecheck` / `lint` / `build` и ручной сценарий в браузере.** Это осознанное отступление от стандартного цикла, зафиксированное в спеке.
- Правило зависимостей FSD строго вниз: `app → views → features → entities → shared`. Слайсы одного слоя друг друга не импортируют.
- Импорт слайсов вне `shared` — только через их публичный `index.ts`. В `shared` импортируются сегменты напрямую (`@/shared/ui/button`).
- Команды линта и типов для веба запускаются с указанием воркспейса: корневой `npm run lint` использует только корневой конфиг и правил `apps/web` не увидит.

## Карта файлов

| Файл | Ответственность |
| --- | --- |
| `apps/web/components.json` | Алиасы shadcn указывают в `shared` |
| `apps/web/next.config.ts` | Загрузка корневого `.env` |
| `apps/web/eslint.config.mjs` | Границы слоёв FSD |
| `src/shared/lib/utils.ts` | `cn` (переезд из `src/lib/`) |
| `src/shared/ui/*` | Компоненты shadcn |
| `src/shared/config/env.ts` | Чтение `API_URL` |
| `src/shared/config/routes.ts` | Константы путей |
| `src/shared/config/session-cookie.ts` | Имя и опции куки сессии |
| `src/shared/api/api-error.ts` | Класс `ApiError` |
| `src/shared/api/api-client.ts` | `apiFetch` — единственная точка выхода в NestJS |
| `src/entities/session/model/user.ts` | Тип `User` |
| `src/entities/session/api/get-session.ts` | `getSession()` — кто залогинен |
| `src/features/auth/model/*` | zod-схемы, тип результата экшена, маппинг ошибок |
| `src/features/auth/api/*.action.ts` | Server Actions: вход, регистрация, выход |
| `src/features/auth/ui/*` | Формы и кнопка выхода |
| `src/views/*` | Вёрстка трёх страниц |
| `src/app/**` | Роутер Next: тонкие реэкспорты и лейауты |
| `src/middleware.ts` | Навигация по сроку жизни токена |

---

### Task 1: Каркас FSD и переезд shadcn

**Files:**
- Modify: `apps/web/components.json`
- Create: `apps/web/src/shared/lib/utils.ts` (переезд `apps/web/src/lib/utils.ts`)
- Create: `apps/web/src/shared/ui/` (компоненты ставит CLI)
- Delete: `apps/web/src/lib/`, `apps/web/src/components/`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` по пути `@/shared/lib/utils`; компоненты `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, `Alert`/`AlertDescription`, `Form`/`FormControl`/`FormField`/`FormItem`/`FormLabel`/`FormMessage` по путям `@/shared/ui/<имя>`.

- [ ] **Step 1: Переписать алиасы в `components.json`**

Заменить блок `aliases` целиком:

```json
  "aliases": {
    "components": "@/shared",
    "ui": "@/shared/ui",
    "utils": "@/shared/lib/utils",
    "lib": "@/shared/lib",
    "hooks": "@/shared/lib/hooks"
  }
```

- [ ] **Step 2: Перенести `utils.ts` в `shared/lib`**

```bash
cd apps/web
mkdir -p src/shared/lib src/shared/ui
git mv src/lib/utils.ts src/shared/lib/utils.ts
rmdir src/lib
git rm -q src/components/ui/.gitkeep
rmdir src/components/ui src/components 2>/dev/null || true
```

`rmdir` здесь подстраховка: git обычно сам убирает опустевшие каталоги.

Содержимое файла не меняется:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Склеивает классы Tailwind, разрешая конфликты в пользу последнего. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Поставить компоненты shadcn**

```bash
cd apps/web
npx shadcn@latest add button input label card alert form
```

CLI сам доставит `react-hook-form`, `@hookform/resolvers`, `zod`, `@radix-ui/react-label`, `@radix-ui/react-slot`. Компоненты должны появиться в `src/shared/ui/`, а не в `src/components/ui/` — если появились не там, значит Step 1 не применился.

- [ ] **Step 4: Зафиксировать версию zod 4**

Проверить, что CLI поставил zod 4-й ветки — план опирается на API `z.email()`, которого в zod 3 нет:

```bash
cd apps/web
node -p "require('zod/package.json').version"
```

Ожидается `4.x`. Если версия 3.x — доставить явно: `npm i zod@^4 -w @expense-tracker/web`.

- [ ] **Step 5: Проверить сборку**

```bash
npm run typecheck -w @expense-tracker/web
npm run lint -w @expense-tracker/web
```

Ожидается: обе команды без ошибок. Компоненты shadcn импортируют `@/shared/lib/utils` — если типы падают на этом импорте, алиас в `components.json` прописан неверно.

- [ ] **Step 6: Коммит**

```bash
git add apps/web
git commit -m "feat(web): каркас shared-слоя FSD и базовые компоненты shadcn"
```

---

### Task 2: Конфигурация окружения и клиент API

**Files:**
- Modify: `.env.example`, `.env`
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/src/shared/config/env.ts`
- Create: `apps/web/src/shared/config/routes.ts`
- Create: `apps/web/src/shared/config/session-cookie.ts`
- Create: `apps/web/src/shared/api/api-error.ts`
- Create: `apps/web/src/shared/api/api-client.ts`

**Interfaces:**
- Consumes: ничего из предыдущих задач.
- Produces:
  - `getApiUrl(): string`
  - `ROUTES: { login: '/login'; register: '/register'; dashboard: '/dashboard' }`
  - `SESSION_COOKIE_NAME: string`, `SESSION_COOKIE_OPTIONS`
  - `class ApiError extends Error { readonly status: number }`
  - `apiFetch<T>(path: string, options?: ApiRequestOptions): Promise<T>`, где `ApiRequestOptions = { method?: 'GET' | 'POST'; body?: unknown; token?: string }`

- [ ] **Step 1: Добавить переменные окружения**

В `.env.example` и в локальный `.env` добавить строку:

```
API_URL=http://localhost:3001/api
```

Там же изменить существующую переменную на `JWT_EXPIRES_IN=7d`. Refresh-токена в API нет, и прежние `15m` выбрасывали бы пользователя из сессии посреди работы.

- [ ] **Step 2: Научить Next читать корневой `.env`**

`.env` лежит в корне монорепозитория, а Next по умолчанию ищет его рядом с приложением. Заменить `apps/web/next.config.ts` целиком:

```ts
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

const repoRoot = new URL('../..', import.meta.url).pathname;

// .env лежит в корне монорепозитория, а Next ищет его в apps/web.
// loadEnvConfig — штатный способ подсунуть ему другой каталог.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Монорепозиторий: корень трейсинга файлов — папка репозитория, а не apps/web
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
```

`@next/env` приезжает вместе с `next`, но как прямая зависимость он в `apps/web/package.json` не объявлен. Добавить его явно, чтобы не зависеть от структуры чужого дерева зависимостей:

```bash
npm i -D @next/env@16.3.0 -w @expense-tracker/web
```

- [ ] **Step 3: Создать `src/shared/config/env.ts`**

```ts
/**
 * Адрес NestJS для серверного кода Next. Префикса NEXT_PUBLIC_ нет намеренно:
 * токен лежит в httpOnly cookie, поэтому браузер в API напрямую не ходит.
 */
export function getApiUrl(): string {
  const apiUrl = process.env['API_URL'];

  if (!apiUrl) {
    throw new Error('Не задана переменная окружения API_URL — проверьте .env в корне репозитория');
  }

  return apiUrl;
}
```

- [ ] **Step 4: Создать `src/shared/config/routes.ts`**

```ts
/** Пути приложения. Собраны в одном месте, чтобы редиректы не разъезжались. */
export const ROUTES = {
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
} as const;
```

- [ ] **Step 5: Создать `src/shared/config/session-cookie.ts`**

```ts
export const SESSION_COOKIE_NAME = 'access_token';

/** Кука сессионная: maxAge не задаём, реальный срок жизни определяет сам JWT. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env['NODE_ENV'] === 'production',
} as const;
```

Константы живут в `shared`, а не в `entities/session`, из-за middleware: он работает в Edge-рантайме, а импорт из бареля `entities/session` затянул бы туда `next/headers`, недоступный в middleware.

- [ ] **Step 6: Создать `src/shared/api/api-error.ts`**

```ts
/** Ошибка запроса к API. status = 0, когда сервер не ответил вовсе. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

- [ ] **Step 7: Создать `src/shared/api/api-client.ts`**

```ts
import { getApiUrl } from '../config/env';
import { ApiError } from './api-error';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
}

// Формат ошибки NestJS. У ValidationPipe message — всегда массив строк.
interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

/** status, которым помечаем недоступность сервера: настоящего кода ответа нет. */
const NETWORK_ERROR_STATUS = 0;

const GENERIC_ERROR_MESSAGE = 'Не удалось выполнить запрос';

/**
 * Запрос к NestJS. Вызывается только из серверного кода — Server Actions и RSC:
 * токен лежит в httpOnly cookie и браузеру недоступен.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, 'Сервис недоступен, попробуйте позже');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const { message } = (await response.json()) as ApiErrorBody;

    if (Array.isArray(message)) {
      return message.join('. ');
    }

    return message ?? GENERIC_ERROR_MESSAGE;
  } catch {
    // Тело неJSON — например, прокси вернул HTML-страницу ошибки.
    return GENERIC_ERROR_MESSAGE;
  }
}
```

- [ ] **Step 8: Проверить типы**

```bash
npm run typecheck -w @expense-tracker/web
npm run lint -w @expense-tracker/web
```

Ожидается: без ошибок.

- [ ] **Step 9: Коммит**

```bash
git add .env.example apps/web
git commit -m "feat(web): клиент API и конфигурация окружения"
```

---

### Task 3: Сущность сессии

**Files:**
- Create: `apps/web/src/entities/session/model/user.ts`
- Create: `apps/web/src/entities/session/api/get-session.ts`
- Create: `apps/web/src/entities/session/index.ts`

**Interfaces:**
- Consumes: `apiFetch` из `@/shared/api/api-client`, `SESSION_COOKIE_NAME` из `@/shared/config/session-cookie`.
- Produces: `getSession(): Promise<User | null>` и тип `User { id: string; name: string; email: string; createdAt: string }` через барель `@/entities/session`.

- [ ] **Step 1: Создать `model/user.ts`**

```ts
/**
 * Зеркало UserReadModel из API. createdAt здесь строка, а не Date:
 * после JSON.parse дата приезжает строкой ISO.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}
```

- [ ] **Step 2: Создать `api/get-session.ts`**

```ts
import { cache } from 'react';
import { cookies } from 'next/headers';
import { apiFetch } from '@/shared/api/api-client';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';
import type { User } from '../model/user';

/**
 * Текущий пользователь или null — единственное место, где фронт узнаёт, кто залогинен.
 * cache() нужен, чтобы несколько серверных компонентов одной страницы
 * не сходили в /auth/me по разу каждый.
 */
export const getSession = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await apiFetch<User>('/auth/me', { token });
  } catch {
    // Протухший, подделанный токен или лежащий API — для интерфейса это одно и то же:
    // пользователь не залогинен.
    return null;
  }
});
```

- [ ] **Step 3: Создать `index.ts`**

```ts
export { getSession } from './api/get-session';
export type { User } from './model/user';
```

- [ ] **Step 4: Проверить типы**

```bash
npm run typecheck -w @expense-tracker/web
npm run lint -w @expense-tracker/web
```

Ожидается: без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/entities
git commit -m "feat(web): сущность сессии с чтением текущего пользователя"
```

---

### Task 4: Схемы и Server Actions авторизации

**Files:**
- Create: `apps/web/src/features/auth/model/login.schema.ts`
- Create: `apps/web/src/features/auth/model/register.schema.ts`
- Create: `apps/web/src/features/auth/model/auth-response.ts`
- Create: `apps/web/src/features/auth/model/action-result.ts`
- Create: `apps/web/src/features/auth/model/to-action-error.ts`
- Create: `apps/web/src/features/auth/api/login.action.ts`
- Create: `apps/web/src/features/auth/api/register.action.ts`
- Create: `apps/web/src/features/auth/api/logout.action.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError`, `ROUTES`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_OPTIONS`, тип `User` из `@/entities/session`.
- Produces:
  - `loginSchema`, тип `LoginValues = { email: string; password: string }`
  - `registerSchema`, тип `RegisterValues = { name: string; email: string; password: string }`
  - `AuthActionError = { error: string; field?: 'email' }`
  - `loginAction(values: LoginValues): Promise<AuthActionError | undefined>`
  - `registerAction(values: RegisterValues): Promise<AuthActionError | undefined>`
  - `logoutAction(): Promise<void>`

  Все три экшена при успехе не возвращают ничего — они уводят редиректом.

- [ ] **Step 1: Создать `model/login.schema.ts`**

```ts
import { z } from 'zod';

/** Повторяет LoginDto из API один в один. */
export const loginSchema = z.object({
  email: z.email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
});

export type LoginValues = z.infer<typeof loginSchema>;
```

- [ ] **Step 2: Создать `model/register.schema.ts`**

```ts
import { z } from 'zod';

/** Повторяет RegisterDto из API один в один. */
export const registerSchema = z.object({
  name: z.string().min(2, 'Имя должно быть не короче 2 символов'),
  email: z.email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
});

export type RegisterValues = z.infer<typeof registerSchema>;
```

- [ ] **Step 3: Создать `model/auth-response.ts`**

```ts
import type { User } from '@/entities/session';

/** Ответ /auth/login и /auth/register. */
export interface AuthResponse {
  accessToken: string;
  user: User;
}
```

- [ ] **Step 4: Создать `model/action-result.ts`**

```ts
/** Экшены не бросают исключения наружу: неудачу возвращают этим объектом. */
export interface AuthActionError {
  error: string;
  /** Заполнено, когда виновато конкретное поле — форма повесит ошибку на него. */
  field?: 'email';
}
```

- [ ] **Step 5: Создать `model/to-action-error.ts`**

```ts
import { ApiError } from '@/shared/api/api-error';
import type { AuthActionError } from './action-result';

const SERVICE_UNAVAILABLE = 'Сервис недоступен, попробуйте позже';

const CONFLICT_STATUS = 409;
const NETWORK_ERROR_STATUS = 0;
const SERVER_ERROR_FLOOR = 500;

/** Превращает ошибку запроса в то, что не стыдно показать пользователю. */
export function toActionError(error: unknown): AuthActionError {
  if (!(error instanceof ApiError)) {
    return { error: SERVICE_UNAVAILABLE };
  }

  // 409 — занятый email: виновато конкретное поле, а не запрос целиком.
  if (error.status === CONFLICT_STATUS) {
    return { error: error.message, field: 'email' };
  }

  // Внутренности 5xx и сетевых сбоев наружу не отдаём.
  if (error.status === NETWORK_ERROR_STATUS || error.status >= SERVER_ERROR_FLOOR) {
    return { error: SERVICE_UNAVAILABLE };
  }

  return { error: error.message };
}
```

- [ ] **Step 6: Создать `api/login.action.ts`**

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/shared/api/api-client';
import { ROUTES } from '@/shared/config/routes';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/shared/config/session-cookie';
import type { AuthResponse } from '../model/auth-response';
import type { AuthActionError } from '../model/action-result';
import { toActionError } from '../model/to-action-error';
import { loginSchema, type LoginValues } from '../model/login.schema';

export async function loginAction(values: LoginValues): Promise<AuthActionError | undefined> {
  // Браузер уже проверил эту же схему, но экшен доступен и в обход формы.
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return { error: 'Проверьте правильность заполнения полей' };
  }

  try {
    const { accessToken } = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: parsed.data,
    });

    (await cookies()).set(SESSION_COOKIE_NAME, accessToken, SESSION_COOKIE_OPTIONS);
  } catch (error) {
    return toActionError(error);
  }

  // redirect работает через исключение — только вне try/catch, иначе catch его проглотит.
  redirect(ROUTES.dashboard);
}
```

- [ ] **Step 7: Создать `api/register.action.ts`**

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/shared/api/api-client';
import { ROUTES } from '@/shared/config/routes';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/shared/config/session-cookie';
import type { AuthResponse } from '../model/auth-response';
import type { AuthActionError } from '../model/action-result';
import { toActionError } from '../model/to-action-error';
import { registerSchema, type RegisterValues } from '../model/register.schema';

export async function registerAction(values: RegisterValues): Promise<AuthActionError | undefined> {
  const parsed = registerSchema.safeParse(values);

  if (!parsed.success) {
    return { error: 'Проверьте правильность заполнения полей' };
  }

  try {
    const { accessToken } = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: parsed.data,
    });

    (await cookies()).set(SESSION_COOKIE_NAME, accessToken, SESSION_COOKIE_OPTIONS);
  } catch (error) {
    return toActionError(error);
  }

  // redirect работает через исключение — только вне try/catch, иначе catch его проглотит.
  redirect(ROUTES.dashboard);
}
```

- [ ] **Step 8: Создать `api/logout.action.ts`**

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';

/**
 * Удаляет куку. Токен на стороне API не отзывается: списка отозванных токенов
 * в NestJS нет, и заводить его эта задача не должна.
 */
export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);

  redirect(ROUTES.login);
}
```

- [ ] **Step 9: Проверить типы**

```bash
npm run typecheck -w @expense-tracker/web
npm run lint -w @expense-tracker/web
```

Ожидается: без ошибок. Если типы ругаются на `z.email` — установлен zod 3, вернуться к Task 1 Step 4.

- [ ] **Step 10: Коммит**

```bash
git add apps/web/src/features
git commit -m "feat(web): server actions входа, регистрации и выхода"
```

---

### Task 5: Формы авторизации

**Files:**
- Create: `apps/web/src/features/auth/ui/login-form.tsx`
- Create: `apps/web/src/features/auth/ui/register-form.tsx`
- Create: `apps/web/src/features/auth/ui/logout-button.tsx`
- Create: `apps/web/src/features/auth/index.ts`

**Interfaces:**
- Consumes: экшены и схемы из Task 4, компоненты `@/shared/ui/*` из Task 1.
- Produces: `LoginForm`, `RegisterForm`, `LogoutButton` — все без пропсов, через барель `@/features/auth`.

- [ ] **Step 1: Создать `ui/login-form.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { loginAction } from '../api/login.action';
import { loginSchema, type LoginValues } from '../model/login.schema';

export function LoginForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    // Успех уводит редиректом, поэтому результат приходит только при неудаче.
    const result = await loginAction(values);

    if (result) {
      setFormError(result.error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Войти
        </Button>
      </form>
    </Form>
  );
}
```

- [ ] **Step 2: Создать `ui/register-form.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { registerAction } from '../api/register.action';
import { registerSchema, type RegisterValues } from '../model/register.schema';

export function RegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);

    // Успех уводит редиректом, поэтому результат приходит только при неудаче.
    const result = await registerAction(values);

    if (!result) {
      return;
    }

    // Занятый email — ошибка поля, а не запроса целиком.
    if (result.field) {
      form.setError(result.field, { message: result.error });
      return;
    }

    setFormError(result.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Анна" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Создать аккаунт
        </Button>
      </form>
    </Form>
  );
}
```

- [ ] **Step 3: Создать `ui/logout-button.tsx`**

```tsx
'use client';

import { useTransition } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { logoutAction } from '../api/logout.action';

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await logoutAction();
        });
      }}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Выйти
    </Button>
  );
}
```

- [ ] **Step 4: Создать `index.ts`**

```ts
export { LoginForm } from './ui/login-form';
export { RegisterForm } from './ui/register-form';
export { LogoutButton } from './ui/logout-button';
```

- [ ] **Step 5: Проверить типы**

```bash
npm run typecheck -w @expense-tracker/web
npm run lint -w @expense-tracker/web
```

Ожидается: без ошибок.

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src/features
git commit -m "feat(web): формы входа и регистрации на react-hook-form"
```

---

### Task 6: Страницы и роуты

**Files:**
- Create: `apps/web/src/views/login/ui/login-page.tsx`, `apps/web/src/views/login/index.ts`
- Create: `apps/web/src/views/register/ui/register-page.tsx`, `apps/web/src/views/register/index.ts`
- Create: `apps/web/src/views/dashboard/ui/dashboard-page.tsx`, `apps/web/src/views/dashboard/index.ts`
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/register/page.tsx`
- Create: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `LoginForm`, `RegisterForm`, `LogoutButton` из `@/features/auth`; `getSession` из `@/entities/session`; `ROUTES`; компоненты `Card*` из `@/shared/ui/card`.
- Produces: `LoginPage`, `RegisterPage`, `DashboardPage` через барели `@/views/<имя>`.

- [ ] **Step 1: Создать `views/login`**

`ui/login-page.tsx`:

```tsx
import Link from 'next/link';
import { LoginForm } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Expense Tracker</CardTitle>
        <CardDescription>Вход в аккаунт</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-muted-foreground text-center text-sm">
          Нет аккаунта?{' '}
          <Link href={ROUTES.register} className="text-foreground underline underline-offset-4">
            Зарегистрироваться
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

`index.ts`:

```ts
export { LoginPage } from './ui/login-page';
```

- [ ] **Step 2: Создать `views/register`**

`ui/register-page.tsx`:

```tsx
import Link from 'next/link';
import { RegisterForm } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function RegisterPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Expense Tracker</CardTitle>
        <CardDescription>Создание аккаунта</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
        <p className="text-muted-foreground text-center text-sm">
          Уже есть аккаунт?{' '}
          <Link href={ROUTES.login} className="text-foreground underline underline-offset-4">
            Войти
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

`index.ts`:

```ts
export { RegisterPage } from './ui/register-page';
```

- [ ] **Step 3: Создать `views/dashboard`**

`ui/dashboard-page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/entities/session';
import { LogoutButton } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export async function DashboardPage() {
  const user = await getSession();

  // Middleware пускает сюда по сроку жизни токена, но подпись проверяет только API —
  // с подделанным токеном сессии всё равно не будет.
  if (!user) {
    redirect(ROUTES.login);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
      <Card>
        <CardHeader>
          <CardTitle>Привет, {user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
```

`index.ts`:

```ts
export { DashboardPage } from './ui/dashboard-page';
```

- [ ] **Step 4: Создать лейаут группы `(auth)`**

`src/app/(auth)/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

/** Общая рамка страниц входа и регистрации: карточка по центру экрана. */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <main className="flex min-h-screen items-center justify-center p-4">{children}</main>;
}
```

- [ ] **Step 5: Создать роуты-реэкспорты**

`src/app/(auth)/login/page.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Вход — Expense Tracker' };

export { LoginPage as default } from '@/views/login';
```

`src/app/(auth)/register/page.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Регистрация — Expense Tracker' };

export { RegisterPage as default } from '@/views/register';
```

`src/app/dashboard/page.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Дашборд — Expense Tracker' };

export { DashboardPage as default } from '@/views/dashboard';
```

- [ ] **Step 6: Заменить `src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';

export default function HomePage() {
  redirect(ROUTES.dashboard);
}
```

- [ ] **Step 7: Проверить сборку**

```bash
npm run typecheck -w @expense-tracker/web
npm run lint -w @expense-tracker/web
npm run build -w @expense-tracker/web
```

Ожидается: всё без ошибок, в выводе сборки видны маршруты `/`, `/login`, `/register`, `/dashboard`.

- [ ] **Step 8: Коммит**

```bash
git add apps/web/src
git commit -m "feat(web): страницы входа, регистрации и дашборда"
```

---

### Task 7: Middleware защиты роутов

**Files:**
- Create: `apps/web/src/middleware.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE_NAME`, `ROUTES` из `@/shared/config/*`.
- Produces: перехват навигации на `/login`, `/register`, `/dashboard/*`.

- [ ] **Step 1: Создать `src/middleware.ts`**

Файл лежит именно в `src/`, а не в корне `apps/web`: при наличии каталога `src` Next ищет middleware только там.

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { ROUTES } from '@/shared/config/routes';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';

const AUTH_ROUTES: readonly string[] = [ROUTES.login, ROUTES.register];

const MILLISECONDS_IN_SECOND = 1000;

interface TokenPayload {
  exp?: number;
}

/**
 * Читает срок жизни из payload токена, не проверяя подпись: подпись проверяет NestJS,
 * а middleware решает только навигационную задачу — иначе на фронт пришлось бы тащить
 * JWT_SECRET и Edge-совместимую криптобиблиотеку.
 *
 * Проверять именно exp, а не наличие куки, обязательно: с протухшим токеном middleware
 * пустил бы на /dashboard, страница получила бы 401 и ушла на /login, а middleware
 * увидел бы куку и вернул обратно — бесконечный цикл редиректов.
 */
function isTokenAlive(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const payload = token.split('.')[1];

  if (!payload) {
    return false;
  }

  try {
    // JWT кодируется base64url, atob понимает только base64.
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(decoded) as TokenPayload;

    return typeof exp === 'number' && exp * MILLISECONDS_IN_SECOND > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const isAuthenticated = isTokenAlive(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && pathname.startsWith(ROUTES.dashboard)) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  if (isAuthenticated && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

// Корень / в matcher не входит: он и так редиректит на /dashboard, где middleware сработает.
export const config = {
  matcher: ['/login', '/register', '/dashboard/:path*'],
};
```

- [ ] **Step 2: Проверить сборку**

```bash
npm run typecheck -w @expense-tracker/web
npm run lint -w @expense-tracker/web
npm run build -w @expense-tracker/web
```

Ожидается: без ошибок, в выводе сборки появилась строка `Middleware`. Если сборка ругается на `next/headers` в Edge-рантайме — значит middleware импортирует что-то из бареля `@/entities/session`, чего делать нельзя.

- [ ] **Step 3: Коммит**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(web): middleware защиты роутов по сроку жизни токена"
```

---

### Task 8: Границы слоёв в ESLint и документация

**Files:**
- Modify: `apps/web/eslint.config.mjs`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: структуру слоёв, созданную в задачах 1–7.
- Produces: правила линта, падающие на нарушении правила зависимостей FSD.

- [ ] **Step 1: Дополнить `apps/web/eslint.config.mjs`**

Вставить блоки перед финальным `{ ignores: [...] }`:

```js
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/views/**', '@/features/**', '@/entities/**'],
              message: 'shared — нижний слой FSD и о вышестоящих слоях не знает.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/views/**', '@/features/**'],
              message: 'entities импортирует только shared.',
            },
            {
              group: ['@/entities/**'],
              message: 'Внутри слайса — относительные пути, соседний слайс трогать нельзя.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/views/**'],
              message: 'features импортирует только entities и shared.',
            },
            {
              group: ['@/features/**'],
              message: 'Внутри слайса — относительные пути, соседний слайс трогать нельзя.',
            },
            {
              group: ['@/entities/*/**'],
              message: 'Импорт только через публичный index.ts слайса: @/entities/session.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/views/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/app/**'], message: 'views не знает о слое app.' },
            {
              group: ['@/views/**'],
              message: 'Внутри слайса — относительные пути, соседний слайс трогать нельзя.',
            },
            {
              group: ['@/features/*/**', '@/entities/*/**'],
              message: 'Импорт только через публичный index.ts слайса.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/middleware.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/views/*/**', '@/features/*/**', '@/entities/*/**'],
              message: 'Импорт только через публичный index.ts слайса.',
            },
          ],
        },
      ],
    },
  },
```

- [ ] **Step 2: Убедиться, что правила работают**

```bash
npm run lint -w @expense-tracker/web
```

Ожидается: без ошибок — весь написанный код правилам соответствует.

Затем проверить, что правила вообще срабатывают. Временно добавить первой строкой в `src/shared/api/api-client.ts`:

```ts
import { LoginForm as _LoginForm } from '@/features/auth';
```

Повторить `npm run lint -w @expense-tracker/web`. Ожидается: ошибка `no-restricted-imports` с текстом «shared — нижний слой FSD и о вышестоящих слоях не знает.». **Удалить эту строку** и убедиться, что линт снова чистый.

- [ ] **Step 3: Добавить раздел про FSD в `CLAUDE.md`**

В раздел «Архитектура» после блока про Prisma добавить:

```markdown
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
без префикса `NEXT_PUBLIC_`. `src/middleware.ts` разруливает навигацию, читая `exp` из payload
токена без проверки подписи — подпись проверяет API. Имя и опции куки лежат в
`src/shared/config/session-cookie.ts`, а не в `entities/session`, потому что middleware работает
в Edge-рантайме и не может тянуть `next/headers` через барель сущности.
```

Также обновить раздел «Состояние проекта»: `apps/web/src/components/ui/` больше не существует, на фронте есть страницы `/login`, `/register` и `/dashboard`.

- [ ] **Step 4: Проверить весь монорепозиторий**

```bash
npm run lint
npm run typecheck
npm run build
npm run format:check
```

Ожидается: всё зелёное. Если `format:check` ругается — прогнать `npm run format`.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/eslint.config.mjs CLAUDE.md
git commit -m "chore(web): закрепить границы слоёв FSD в ESLint и описать их в CLAUDE.md"
```

---

### Task 9: Ручная приёмка

**Files:** изменений нет — только проверка.

**Interfaces:**
- Consumes: всё, собранное в задачах 1–8.

- [ ] **Step 1: Поднять окружение**

Три терминала:

```bash
npm run db:up
npm run dev:api
npm run dev:web
```

Убедиться, что миграции применены (`npm run db:migrate`) и Prisma Client сгенерирован (`npm run db:generate`).

- [ ] **Step 2: Пройти сценарии**

Отметить каждый:

- [ ] Регистрация нового пользователя на `/register` → редирект на `/dashboard`, видно своё имя и email.
- [ ] Кнопка «Выйти» → редирект на `/login`.
- [ ] Вход тем же пользователем на `/login` → снова `/dashboard`.
- [ ] Вход с неверным паролем → «Неверный email или пароль» в красном `Alert` над кнопкой.
- [ ] Регистрация на уже занятый email → «Пользователь с таким email уже существует» под полем email, а не общим алертом.
- [ ] Ввод пароля короче 8 символов → ошибка появляется до отправки, запроса к API нет (проверить во вкладке Network).
- [ ] Заход на `/dashboard` без куки (режим инкогнито) → редирект на `/login`.
- [ ] Заход на `/login` с валидной кукой → редирект на `/dashboard`.
- [ ] Заход на `/` → редирект на `/dashboard` (и дальше на `/login`, если не залогинен).
- [ ] Проверить в DevTools → Application → Cookies, что у `access_token` стоит флаг `HttpOnly`, а `document.cookie` в консоли его не показывает.
- [ ] Остановить `dev:api` и попробовать войти → «Сервис недоступен, попробуйте позже», без стектрейса на экране.

- [ ] **Step 3: Коммит, если что-то правилось**

Если по ходу приёмки нашлись баги — чинить и коммитить отдельными коммитами с префиксом `fix(web):`.

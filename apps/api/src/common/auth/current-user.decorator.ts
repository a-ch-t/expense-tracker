import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload';

/**
 * Параметр-декоратор: подставляет в аргумент хендлера payload JWT текущего пользователя.
 * Требует, чтобы перед хендлером отработал `JwtAuthGuard` и записал `request.user`.
 * @param _data - аргумент декоратора при вызове `@CurrentUser()`; не используется.
 * @param context - контекст выполнения запроса, из которого достаётся `Request`.
 * @returns payload из `request.user`; `undefined`, если декоратор применён без `JwtAuthGuard`
 * и `request.user` не был заполнен.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);

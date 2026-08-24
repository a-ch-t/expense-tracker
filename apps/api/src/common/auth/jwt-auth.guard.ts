import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { GetUserByIdQuery, type UserReadModel } from '../../contracts/users';
import type { JwtPayload } from './jwt-payload';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Гард авторизации: проверяет JWT из заголовка `Authorization` и существование его владельца.
 * Общий для всех модулей с закрытыми эндпоинтами — импортируется через `AuthCoreModule`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Проверяет токен запроса и наличие пользователя, затем записывает payload в `request.user`.
   * @param context - контекст выполнения запроса.
   * @returns `true`, если запрос авторизован.
   * @throws {UnauthorizedException} если токен отсутствует, недействителен (просрочен или
   * подпись не сходится) или пользователь из payload больше не существует.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Отсутствует токен авторизации');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Недействительный токен авторизации');
    }

    // Подпись верна и срок не вышел — это ещё не значит, что пользователь существует:
    // аккаунт могли удалить, пока токен жив. Проверка здесь, а не в каждом сервисе,
    // потому что инвариант общий для всех закрытых эндпоинтов, а места, где о нём
    // забыли, снаружи неотличимы от «данных просто нет».
    const owner = await this.queryBus.execute<GetUserByIdQuery, UserReadModel | null>(
      new GetUserByIdQuery(payload.sub),
    );

    if (!owner) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    request.user = payload;

    return true;
  }

  /**
   * Достаёт токен из заголовка `Authorization: Bearer <token>`.
   * @param request - входящий HTTP-запрос.
   * @returns токен без префикса `Bearer`, либо `undefined`, если заголовка нет или схема
   * не `Bearer`.
   */
  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    const [type, token] = header?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

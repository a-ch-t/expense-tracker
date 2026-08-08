import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserCommand,
  GetUserByEmailQuery,
  type UserCredentials,
  type UserReadModel,
} from '../contracts/users';
import type { JwtPayload } from '../common/auth';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 10;

// Хэш заведомо несуществующего пароля: сравниваем с ним, когда пользователь не найден,
// чтобы bcrypt.compare занимал одинаковое время и не выдавал таймингом факт существования email.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-such-user-password', BCRYPT_ROUNDS);

interface AuthResult {
  accessToken: string;
  user: UserReadModel;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.commandBus.execute<CreateUserCommand, UserReadModel>(
      new CreateUserCommand(dto.name, dto.email, passwordHash),
    );

    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const credentials = await this.queryBus.execute<GetUserByEmailQuery, UserCredentials | null>(
      new GetUserByEmailQuery(dto.email),
    );

    const passwordMatches = await bcrypt.compare(
      dto.password,
      credentials?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!credentials || !passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueToken(credentials);
  }

  private issueToken(user: UserReadModel): AuthResult {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    // Перечисляем поля явно: credentials (с passwordHash) — тоже валидный UserReadModel
    // по структуре, и без этого хэш пароля утёк бы в ответ login.
    const safeUser: UserReadModel = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
    return { accessToken: this.jwtService.sign(payload), user: safeUser };
  }
}

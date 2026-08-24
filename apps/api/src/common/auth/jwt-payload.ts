/** Полезная нагрузка JWT: то, что подписывается при логине и проверяется `JwtAuthGuard`. */
export interface JwtPayload {
  sub: string;
  email: string;
}

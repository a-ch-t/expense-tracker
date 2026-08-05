/** Публичное представление пользователя — без пароля. */
export interface UserReadModel {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

/** То же самое плюс хэш пароля — только для сценария логина. */
export interface UserCredentials extends UserReadModel {
  passwordHash: string;
}

# Новая функциональность

## Контекст (что уже есть)
- NestJS + Next.js + PostgreSQL + Prisma
- Авторизация (JWT), модуль категорий

## Задача
- Центральный модуль учёта доходов и расходов.

## Модель данных
- Транзакция: id, amount, type (income/expense), description, date, categoryId, userId

## Контроллер и эндпоинты
- POST /transactions, GET /transactions (агрегация по month/year),
- GET /transactions/:id, PATCH /transactions/:id, DELETE /transactions/:id

## Паттерн
- Следуй структуре модуля из src/modules/categories/
- Взаимодействие через CQRS

## Ограничения
- Не добавлять зависимости без указания
- class-validator для DTO
- После реализации запустить сборку
/**
 * Форматирование денег и дат. Форматтеры создаются один раз на модуль:
 * конструктор Intl дорогой, а список операций зовёт их на каждую строку.
 */

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Цифрами, а не «16 авг. 2026 г.»: в колонке дат важна одинаковая ширина, а не читаемость вслух
const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Сумма с валютой: 1 250,50 ₽. Знак операции добавляет вызывающий код. */
export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount);
}

/** Дата операции: 16.08.2026. На вход — строка ISO, как её отдаёт API. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}

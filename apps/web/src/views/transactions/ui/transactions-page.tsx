import { InDevelopment } from '@/shared/ui/in-development';

export function TransactionsPage() {
  return (
    <InDevelopment
      title="Транзакции"
      description="Полный список операций, фильтры по периоду и добавление записей."
    >
      Последние десять операций уже видны на главной.
    </InDevelopment>
  );
}

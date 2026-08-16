import { InDevelopment } from '@/shared/ui/in-development';

export function TransactionsPage() {
  return (
    <InDevelopment
      title="Транзакции"
      description="Раздел в разработке: здесь появятся полный список операций, фильтры по периоду и добавление записей."
    >
      Последние десять операций уже видны на главной.
    </InDevelopment>
  );
}

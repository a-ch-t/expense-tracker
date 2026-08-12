import { LegalPage } from './legal-page';

export function TermsPage() {
  return (
    <LegalPage title="Пользовательское соглашение">
      {/* Заглушка: текст документа появится здесь, когда его подготовят. */}
      <p className="text-muted-foreground">
        Текст пользовательского соглашения пока не опубликован. Здесь будут условия использования
        Expense Tracker.
      </p>
    </LegalPage>
  );
}

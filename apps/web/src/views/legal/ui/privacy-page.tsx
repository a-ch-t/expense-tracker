import { LegalPage } from './legal-page';

export function PrivacyPage() {
  return (
    <LegalPage title="Политика обработки данных">
      {/* Заглушка: текст документа появится здесь, когда его подготовят. */}
      <p className="text-muted-foreground">
        Текст политики обработки данных пока не опубликован. Здесь будут правила сбора, хранения и
        обработки персональных данных.
      </p>
    </LegalPage>
  );
}

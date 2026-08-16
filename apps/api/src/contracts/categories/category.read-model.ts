/** Публичное представление категории. userId не отдаём — он всегда равен текущему пользователю. */
export interface CategoryReadModel {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
}

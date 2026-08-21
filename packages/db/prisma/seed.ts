import { createPrismaClient, TransactionType } from '../src/index';

const prisma = createPrismaClient();

const DEMO_EMAIL = 'demo@example.com';

/**
 * Пароль демо-пользователя — `demo-password`.
 *
 * Хэш записан константой, а не считается на месте: bcryptjs — зависимость apps/api,
 * и тянуть её в packages/db ради сида значит размазать знание о хэшировании паролей
 * по второму пакету. Хэш получен тем же bcryptjs с 10 раундами, что и в AuthService.
 */
const DEMO_PASSWORD_HASH = '$2b$10$rxqAjU4/2J3AmNjy8orGwOQcMdZgX0pYn.9jQR243717q2kmij5E2';

/** Категории демо-пользователя: цвет в #rrggbb, иконка — имя lucide в kebab-case. */
const CATEGORIES = [
  { name: 'Продукты', color: '#f97316', icon: 'shopping-cart' },
  { name: 'Транспорт', color: '#0ea5e9', icon: 'bus' },
  { name: 'Жильё', color: '#8b5cf6', icon: 'house' },
  { name: 'Развлечения', color: '#ec4899', icon: 'clapperboard' },
  { name: 'Зарплата', color: '#22c55e', icon: 'wallet' },
] as const;

type CategoryName = (typeof CATEGORIES)[number]['name'];

interface SeedTransaction {
  category: CategoryName;
  amount: number;
  type: TransactionType;
  description: string;
  /** Дата операции в UTC — периоды в API считаются полуинтервалом в UTC. */
  date: string;
}

// Два месяца операций: одного мало, чтобы фильтр по периоду было на чём проверить.
const TRANSACTIONS: readonly SeedTransaction[] = [
  {
    category: 'Зарплата',
    amount: 180000,
    type: 'income',
    description: 'Зарплата за июль',
    date: '2026-07-10',
  },
  {
    category: 'Жильё',
    amount: 65000,
    type: 'expense',
    description: 'Аренда квартиры',
    date: '2026-07-11',
  },
  {
    category: 'Продукты',
    amount: 4380.5,
    type: 'expense',
    description: 'Продукты на неделю',
    date: '2026-07-13',
  },
  {
    category: 'Транспорт',
    amount: 2500,
    type: 'expense',
    description: 'Проездной',
    date: '2026-07-15',
  },
  {
    category: 'Развлечения',
    amount: 1800,
    type: 'expense',
    description: 'Кино',
    date: '2026-07-19',
  },
  {
    category: 'Продукты',
    amount: 5120.9,
    type: 'expense',
    description: 'Продукты на неделю',
    date: '2026-07-27',
  },

  {
    category: 'Зарплата',
    amount: 180000,
    type: 'income',
    description: 'Зарплата за август',
    date: '2026-08-10',
  },
  {
    category: 'Жильё',
    amount: 65000,
    type: 'expense',
    description: 'Аренда квартиры',
    date: '2026-08-11',
  },
  {
    category: 'Продукты',
    amount: 6240.3,
    type: 'expense',
    description: 'Продукты на неделю',
    date: '2026-08-12',
  },
  {
    category: 'Транспорт',
    amount: 990,
    type: 'expense',
    description: 'Такси до аэропорта',
    date: '2026-08-14',
  },
  {
    category: 'Развлечения',
    amount: 3400,
    type: 'expense',
    description: 'Концерт',
    date: '2026-08-16',
  },
  {
    category: 'Продукты',
    amount: 3890,
    type: 'expense',
    description: 'Продукты на неделю',
    date: '2026-08-19',
  },
  {
    category: 'Зарплата',
    amount: 25000,
    type: 'income',
    description: 'Подработка',
    date: '2026-08-20',
  },
];

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { name: 'Демо', email: DEMO_EMAIL, passwordHash: DEMO_PASSWORD_HASH },
  });

  // Транзакции сносим до категорий: FK categoryId объявлен с onDelete: Restrict,
  // и категорию с операциями удалить нельзя. Заодно сид становится идемпотентным —
  // повторный запуск не удваивает список операций.
  await prisma.transaction.deleteMany({ where: { userId: user.id } });

  const categories = new Map<CategoryName, string>();

  for (const category of CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: category.name } },
      update: { color: category.color, icon: category.icon },
      create: { ...category, userId: user.id },
    });
    categories.set(category.name, saved.id);
  }

  await prisma.transaction.createMany({
    data: TRANSACTIONS.map((transaction) => {
      const categoryId = categories.get(transaction.category);

      if (!categoryId) {
        // Недостижимо: имена берутся из CATEGORIES, но noUncheckedIndexedAccess
        // требует обработать undefined явно, а не глушить приведением типа.
        throw new Error(`Категория «${transaction.category}» не найдена среди созданных`);
      }

      return {
        userId: user.id,
        categoryId,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        date: new Date(`${transaction.date}T00:00:00.000Z`),
      };
    }),
  });

  console.log(
    `Seed: пользователь ${DEMO_EMAIL} (пароль demo-password), ` +
      `категорий — ${CATEGORIES.length}, операций — ${TRANSACTIONS.length}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

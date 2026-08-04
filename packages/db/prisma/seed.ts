import { createPrismaClient } from '../src/index';

const prisma = createPrismaClient();

async function main(): Promise<void> {
  // Наполнение появится вместе с моделями в schema.prisma.
  console.log('Seed: моделей пока нет, наполнять нечего.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

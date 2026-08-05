import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// npm workspace-скрипты запускают этот файл с cwd = packages/db, поэтому
// путь к корневому .env указываем явно — иначе dotenv ищет .env рядом с собой.
config({ path: '../../.env' });

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});

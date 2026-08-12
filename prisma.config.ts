import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsnd --transpile-only src/seeds/seed.ts',
  },
  datasource: {
    url: env<Env>('DATABASE_URL'),
  },
});

import { defineConfig } from 'prisma/config';

// Local development reads apps/api/.env; deployed environments inject real variables.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the process environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` needs no database, so a missing URL only fails commands that connect.
    url: process.env.DATABASE_URL ?? '',
  },
});

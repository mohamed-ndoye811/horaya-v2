import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/persistence/postgres/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/horaya',
  },
  verbose: true,
  strict: true,
});

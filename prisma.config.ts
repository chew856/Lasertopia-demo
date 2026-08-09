import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Presence of this file switches off the CLI's own .env loading, so do it here. Node's
// built-in loader keeps `dotenv` out of the dependency list.
const envFile = path.join(process.cwd(), '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * Prisma CLI configuration. Replaces the deprecated `package.json#prisma` block.
 * `DATABASE_URL` still comes from .env — switching to Postgres is that variable plus the
 * `provider` line in schema.prisma.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});

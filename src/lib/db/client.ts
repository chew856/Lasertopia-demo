import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * EPHEMERAL DEMO MODE
 *
 * On a serverless host the application directory is read-only, so the seeded SQLite file
 * shipped in the bundle cannot be written to. `/tmp` is the one writable location, and it
 * is wiped whenever the instance is recycled.
 *
 * So on first use we copy the read-only template into `/tmp` and point Prisma there.
 * Bookings then work completely — holds, deposits, the manager board, the unique index
 * that prevents double-booking — and the whole thing resets to a clean, config-only
 * database when the instance goes away. Nothing a visitor enters is kept.
 *
 * The template contains configuration ONLY: rooms, party windows, packages, prices,
 * pizza tiers, settings. It contains no bookings and no personal data.
 *
 * To run against a real database instead, set DATABASE_URL to a persistent Postgres URL
 * and change `provider` in schema.prisma. Nothing else here needs to change.
 */

const TEMPLATE_CANDIDATES = [
  path.join(process.cwd(), 'prisma', 'demo.db'),
  path.join(process.cwd(), '.next', 'server', 'prisma', 'demo.db'),
  path.join(process.cwd(), '..', 'prisma', 'demo.db'),
];

/** A writable copy of the seeded template, or null if we could not make one. */
function provisionEphemeralDatabase(): string | null {
  const target = path.join('/tmp', 'lasertopia-demo.db');

  try {
    // Already provisioned by an earlier request on this same warm instance.
    if (fs.existsSync(target) && fs.statSync(target).size > 0) return target;

    const template = TEMPLATE_CANDIDATES.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).size > 0,
    );
    if (!template) {
      console.error(
        '[db] No seeded template found. Looked in:\n  ' + TEMPLATE_CANDIDATES.join('\n  '),
      );
      return null;
    }

    fs.copyFileSync(template, target);
    console.info(`[db] Ephemeral demo database provisioned from ${template}`);
    return target;
  } catch (error) {
    console.error('[db] Could not provision the ephemeral demo database:', error);
    return null;
  }
}

function resolveDatabaseUrl(): string | undefined {
  const configured = process.env.DATABASE_URL;

  // A non-SQLite URL means someone has pointed this at a real database. Respect it.
  if (configured && !configured.startsWith('file:')) return configured;

  // Serverless: the bundled SQLite file is read-only, so run from /tmp instead.
  const isServerless = Boolean(process.env.VERCEL) || process.env.DEMO_EPHEMERAL_DB === '1';
  if (isServerless) {
    const ephemeral = provisionEphemeralDatabase();
    if (ephemeral) return `file:${ephemeral}`;
  }

  return configured;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = resolveDatabaseUrl();

/** Single client per process; Next.js dev hot-reload would otherwise leak connections. */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

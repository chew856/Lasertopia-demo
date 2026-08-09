import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db/client';

import {
  AuthConfigError,
  assertUsableSecret,
  isLocked,
  newSession,
  registerAttempt,
  signSession,
  verifyPassword,
  verifySession,
  type AttemptRecord,
  type StaffSession,
} from './session-token';

/**
 * The one module in this surface that reads the environment, and the only place a session
 * cookie is written or read.
 *
 * **Fail closed.** If `MANAGER_SESSION_SECRET` or the bootstrap credentials are unset,
 * `staffAuthConfig()` throws, `getSession()` returns null and every staff route redirects to
 * `/manage/login`, which explains what is missing. A server that is not configured for
 * sign-in serves no staff screens at all — it does not fall back to an open backend.
 *
 * **No credential is ever a literal.** `MANAGER_PASSWORD_HASH` holds a scrypt hash generated
 * by the operator; nothing in `src/` contains a password, and nothing writes one to disk.
 */

export const SESSION_COOKIE = 'lt_manager_session';

/**
 * Scoped to `/manage`, which under RFC 6265 path matching does **not** include
 * `/manage-booking` — that route is public and must never see a staff cookie.
 */
const COOKIE_PATH = '/manage';

/** One long shift. A staff tablet left on the desk should not stay signed in overnight. */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

const LOGIN_ATTEMPT_LIMIT = 5;
/** COPY.md `mg.login.locked` — "Wait 5 minutes". */
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export interface StaffAuthConfig {
  sessionSecret: string;
  bootstrapEmail: string;
  bootstrapPasswordHash: string;
  bootstrapName: string;
}

/**
 * Reads and validates the environment. Throws `AuthConfigError` with the exact variable
 * names when anything is missing, which is what the login screen renders.
 */
export function staffAuthConfig(): StaffAuthConfig {
  const sessionSecret = process.env.MANAGER_SESSION_SECRET;
  assertUsableSecret(sessionSecret);

  const bootstrapEmail = process.env.MANAGER_EMAIL?.trim().toLowerCase();
  const bootstrapPasswordHash = process.env.MANAGER_PASSWORD_HASH?.trim();
  if (!bootstrapEmail || !bootstrapPasswordHash) {
    throw new AuthConfigError(
      'MANAGER_EMAIL and MANAGER_PASSWORD_HASH must both be set before staff sign-in will work. ' +
        'MANAGER_PASSWORD_HASH holds a scrypt hash, never a password — see .env.example for the ' +
        'one-line command that generates one.',
    );
  }
  if (!bootstrapPasswordHash.startsWith('scrypt$')) {
    throw new AuthConfigError(
      'MANAGER_PASSWORD_HASH does not look like a scrypt hash (it must start with "scrypt$"). ' +
        'It holds a hash, not a password — see .env.example.',
    );
  }

  return {
    sessionSecret,
    bootstrapEmail,
    bootstrapPasswordHash,
    bootstrapName: process.env.MANAGER_NAME?.trim() || bootstrapEmail.split('@')[0],
  };
}

/** Whether sign-in is configured at all, without throwing. Used by the login screen. */
export function authConfigError(): string | null {
  try {
    staffAuthConfig();
    return null;
  } catch (error) {
    if (error instanceof AuthConfigError) return error.message;
    throw error;
  }
}

// ─── Reading the session ─────────────────────────────────────────────────────────────────

/** The signed-in staff member, or null. Never throws — an unconfigured server has no session. */
export async function getSession(): Promise<StaffSession | null> {
  let secret: string;
  try {
    secret = staffAuthConfig().sessionSecret;
  } catch {
    return null;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, secret, Math.floor(Date.now() / 1000));
}

/**
 * The guard every staff page and every staff mutation calls. Redirects rather than throwing,
 * so a bookmarked `/manage/settings` lands on the login screen with a reason.
 */
export async function requireStaff(): Promise<StaffSession> {
  const session = await getSession();
  if (!session) redirect('/manage/login?reason=expired');
  return session;
}

// ─── Signing in ──────────────────────────────────────────────────────────────────────────

/**
 * Login throttling state. In-process, which is honest about what it is: one desk, one server.
 * On more than one instance this becomes a shared-store concern, and the `mg.login.locked`
 * promise is what would need to hold.
 */
const attempts = new Map<string, AttemptRecord>();

export type LoginOutcome =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'locked' | 'unconfigured' | 'server'; message?: string };

/**
 * Verify credentials and set the cookie. Callable only from a Server Action or a Route
 * Handler — those are the only contexts allowed to write a cookie.
 *
 * Order of resolution:
 *  1. the bootstrap account in the environment, which is authoritative for its own email;
 *  2. an active `ManagerUser` row, so a venue can add staff without a redeploy.
 *
 * A successful bootstrap sign-in upserts the `ManagerUser` row so every audit entry has a
 * real actor id to point at. The row stores the same hash the environment holds — never a
 * password, and never a value invented here.
 */
export async function signIn(emailInput: string, password: string): Promise<LoginOutcome> {
  let config: StaffAuthConfig;
  try {
    config = staffAuthConfig();
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return { ok: false, reason: 'unconfigured', message: error.message };
    }
    throw error;
  }

  const email = emailInput.trim().toLowerCase();
  if (email === '' || password === '') return { ok: false, reason: 'invalid' };

  const nowMs = Date.now();
  if (isLocked(attempts.get(email), nowMs, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS)) {
    return { ok: false, reason: 'locked' };
  }

  let user: { id: string; email: string; name: string; role: 'MANAGER' | 'STAFF' } | null = null;

  try {
    if (email === config.bootstrapEmail) {
      if (verifyPassword(password, config.bootstrapPasswordHash)) {
        const row = await prisma.managerUser.upsert({
          where: { email },
          create: {
            email,
            name: config.bootstrapName,
            passwordHash: config.bootstrapPasswordHash,
            role: 'MANAGER',
            isActive: true,
            lastLoginAt: new Date(),
          },
          update: {
            passwordHash: config.bootstrapPasswordHash,
            isActive: true,
            lastLoginAt: new Date(),
          },
          select: { id: true, email: true, name: true, role: true },
        });
        user = { ...row, role: row.role === 'MANAGER' ? 'MANAGER' : 'STAFF' };
      }
    } else {
      const row = await prisma.managerUser.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true, passwordHash: true, isActive: true },
      });
      if (row && row.isActive && verifyPassword(password, row.passwordHash)) {
        await prisma.managerUser.update({ where: { id: row.id }, data: { lastLoginAt: new Date() } });
        user = {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role === 'MANAGER' ? 'MANAGER' : 'STAFF',
        };
      }
    }
  } catch {
    return { ok: false, reason: 'server' };
  }

  if (!user) {
    const decision = registerAttempt(attempts.get(email), nowMs, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
    attempts.set(email, decision.next);
    return { ok: false, reason: decision.locked ? 'locked' : 'invalid' };
  }

  attempts.delete(email);

  const nowSeconds = Math.floor(nowMs / 1000);
  const token = signSession(newSession(user, nowSeconds, SESSION_TTL_SECONDS), config.sessionSecret);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: COOKIE_PATH,
    maxAge: SESSION_TTL_SECONDS,
  });
  return { ok: true };
}

export async function signOut(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: COOKIE_PATH,
    maxAge: 0,
  });
}

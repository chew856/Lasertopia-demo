/**
 * The staff session token and password verification — the whole of the crypto, with no
 * framework, no database and no ambient clock.
 *
 * Why this is hand-rolled rather than an auth SDK: the manager backend has exactly one
 * requirement an SDK would satisfy — "prove this request came from someone who knew the
 * staff password, and let the server tell who without a database round-trip". That is one
 * HMAC over one JSON payload. Auth.js would add a provider model, a database adapter, a JWT
 * encryption layer and a `/api/auth/*` route tree for the same result, and every one of those
 * is a place for a misconfiguration to become a silent auth bypass. `node:crypto` is in the
 * standard library, the token format is 40 lines, and it is testable without a server.
 *
 * Two properties this file exists to guarantee:
 *
 *  1. **No secret is ever a literal.** Every function takes the secret as an argument;
 *     nothing here reads `process.env`. `auth.ts` is the one module that touches the
 *     environment, and it fails closed when a variable is missing.
 *  2. **Every comparison is constant-time.** Both the signature check and the password check
 *     go through `timingSafeEqual` on equal-length buffers, so neither leaks by timing.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Who is signed in. Small on purpose — it rides in a cookie on every request. */
export interface StaffSession {
  /** `ManagerUser.id`, so every audit row can name a real actor. */
  sub: string;
  email: string;
  /** Display name, used verbatim in `{staffName}` copy. */
  name: string;
  role: 'MANAGER' | 'STAFF';
  /** Seconds since the epoch. */
  iat: number;
  exp: number;
}

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
  }
}

// ─── scrypt password hashes ──────────────────────────────────────────────────────────────

/** The scrypt cost parameters the stored hash is generated with. Encoded in the hash string. */
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_DEFAULTS = { N: 16384, r: 8, p: 1 } as const;

/**
 * `scrypt$N$r$p$saltHex$keyHex` — self-describing, so raising the cost later does not
 * invalidate hashes generated today.
 */
export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const { N, r, p } = SCRYPT_DEFAULTS;
  const key = scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: 128 * N * r * 4,
  });
  return ['scrypt', N, r, p, salt.toString('hex'), key.toString('hex')].join('$');
}

/**
 * Constant-time password check. Returns false — never throws — for a malformed stored hash,
 * because a hash the operator typed wrong must fail closed rather than crash the login route.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.trim().split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (!/^[0-9a-f]+$/i.test(parts[4]) || !/^[0-9a-f]+$/i.test(parts[5])) return false;

  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: 128 * N * r * 4,
    });
  } catch {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

// ─── The session token ───────────────────────────────────────────────────────────────────

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signaturePart(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Rejects a secret too short to be one, rather than signing with a placeholder. */
export function assertUsableSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.trim().length < 32) {
    throw new AuthConfigError(
      'MANAGER_SESSION_SECRET must be set to at least 32 characters before staff sign-in will work. ' +
        'Generate one with `node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"` ' +
        'and put it in .env — see .env.example.',
    );
  }
}

/** `<payload>.<hmac>`, both base64url. Not encrypted: the payload carries no secret. */
export function signSession(session: StaffSession, secret: string): string {
  assertUsableSecret(secret);
  const payload = base64url(JSON.stringify(session));
  return `${payload}.${signaturePart(payload, secret)}`;
}

/**
 * Verify a token and return the session, or `null`.
 *
 * `nowSeconds` is a parameter for the same reason no domain function reads the clock: an
 * expiry rule you cannot move time against is an expiry rule you cannot test.
 */
export function verifySession(
  token: string | undefined,
  secret: string | undefined,
  nowSeconds: number,
): StaffSession | null {
  if (!token || !secret) return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  const expected = signaturePart(payload, secret);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  // Length is compared first because timingSafeEqual throws on a mismatch; the length of a
  // base64url SHA-256 digest is public information, so this leaks nothing.
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.sub !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.name !== 'string' ||
    (candidate.role !== 'MANAGER' && candidate.role !== 'STAFF') ||
    typeof candidate.iat !== 'number' ||
    typeof candidate.exp !== 'number'
  ) {
    return null;
  }
  if (candidate.exp <= nowSeconds) return null;

  return {
    sub: candidate.sub,
    email: candidate.email,
    name: candidate.name,
    role: candidate.role,
    iat: candidate.iat,
    exp: candidate.exp,
  };
}

/** Build the payload for a fresh sign-in. `ttlSeconds` covers one long shift, not a month. */
export function newSession(
  user: { id: string; email: string; name: string; role: 'MANAGER' | 'STAFF' },
  nowSeconds: number,
  ttlSeconds: number,
): StaffSession {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
}

// ─── Login throttling ────────────────────────────────────────────────────────────────────

export interface AttemptRecord {
  count: number;
  /** Milliseconds since the epoch of the first attempt in the current window. */
  windowStartedAtMs: number;
}

export interface ThrottleDecision {
  locked: boolean;
  next: AttemptRecord;
}

/**
 * COPY.md `mg.login.locked` promises a five-minute wait after too many attempts, so the rule
 * is here as a pure function over the previous record: the caller keeps the map, this decides.
 */
export function registerAttempt(
  previous: AttemptRecord | undefined,
  nowMs: number,
  limit: number,
  windowMs: number,
): ThrottleDecision {
  if (!previous || nowMs - previous.windowStartedAtMs >= windowMs) {
    return { locked: false, next: { count: 1, windowStartedAtMs: nowMs } };
  }
  const next: AttemptRecord = {
    count: previous.count + 1,
    windowStartedAtMs: previous.windowStartedAtMs,
  };
  return { locked: next.count > limit, next };
}

/** Whether an existing record still has the account locked, without recording an attempt. */
export function isLocked(
  previous: AttemptRecord | undefined,
  nowMs: number,
  limit: number,
  windowMs: number,
): boolean {
  if (!previous) return false;
  if (nowMs - previous.windowStartedAtMs >= windowMs) return false;
  return previous.count > limit;
}

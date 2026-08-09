import { describe, expect, it } from 'vitest';

import {
  AuthConfigError,
  assertUsableSecret,
  hashPassword,
  isLocked,
  newSession,
  registerAttempt,
  signSession,
  verifyPassword,
  verifySession,
  type StaffSession,
} from '@/app/manage/_lib/session-token';

/**
 * The staff session is the whole of the manager backend's authorisation. These tests exist to
 * pin the three properties that would make it worthless if they silently stopped holding:
 * a tampered token must not verify, an expired one must not verify, and a missing secret must
 * fail closed rather than fall through to "signed in".
 */

const SECRET = 'a'.repeat(48);
const OTHER_SECRET = 'b'.repeat(48);
const NOW = 1_760_000_000;

function session(overrides: Partial<StaffSession> = {}): StaffSession {
  return {
    sub: 'user_1',
    email: 'priya@lasertopia.test',
    name: 'Priya',
    role: 'MANAGER',
    iat: NOW,
    exp: NOW + 3600,
    ...overrides,
  };
}

describe('password hashing', () => {
  it('verifies a password against its own scrypt hash', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects the wrong password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('Correct horse battery staple', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
  });

  it('encodes its own cost parameters so they can be raised later', () => {
    const stored = hashPassword('hunter2');
    const [scheme, N, r, p, salt, key] = stored.split('$');
    expect(scheme).toBe('scrypt');
    expect(Number(N)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(/^[0-9a-f]{128}$/);
  });

  it('fails closed on a malformed stored hash rather than throwing', () => {
    // An operator who pasted a password instead of a hash must be locked out, not crash the
    // login route into a 500 that reveals the shape of the value.
    expect(verifyPassword('anything', 'hunter2')).toBe(false);
    expect(verifyPassword('anything', 'scrypt$16384$8$1$zz$zz')).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
    expect(verifyPassword('anything', 'scrypt$16384$8$1$abcd')).toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips a session', () => {
    const token = signSession(session(), SECRET);
    expect(verifySession(token, SECRET, NOW)).toEqual(session());
  });

  it('rejects a token signed with a different secret', () => {
    const token = signSession(session(), OTHER_SECRET);
    expect(verifySession(token, SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signSession(session({ role: 'STAFF' }), SECRET);
    const forged = Buffer.from(
      JSON.stringify(session({ role: 'MANAGER' })),
      'utf8',
    ).toString('base64url');
    const tampered = `${forged}.${token.slice(token.indexOf('.') + 1)}`;
    expect(verifySession(tampered, SECRET, NOW)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = signSession(session({ exp: NOW + 10 }), SECRET);
    expect(verifySession(token, SECRET, NOW + 9)).not.toBeNull();
    expect(verifySession(token, SECRET, NOW + 10)).toBeNull();
    expect(verifySession(token, SECRET, NOW + 11)).toBeNull();
  });

  it('rejects garbage without throwing', () => {
    for (const bad of ['', '.', 'nodot', 'a.b', 'a.', '.b']) {
      expect(verifySession(bad, SECRET, NOW)).toBeNull();
    }
    expect(verifySession(`${Buffer.from('{').toString('base64url')}.x`, SECRET, NOW)).toBeNull();
  });

  it('fails closed when there is no secret to verify against', () => {
    const token = signSession(session(), SECRET);
    expect(verifySession(token, undefined, NOW)).toBeNull();
    expect(verifySession(undefined, SECRET, NOW)).toBeNull();
  });

  it('refuses to sign with a secret that is missing or too short', () => {
    expect(() => assertUsableSecret(undefined)).toThrow(AuthConfigError);
    expect(() => assertUsableSecret('')).toThrow(AuthConfigError);
    expect(() => assertUsableSecret('short')).toThrow(AuthConfigError);
    expect(() => assertUsableSecret('x'.repeat(32))).not.toThrow();
  });

  it('stamps issue and expiry from the clock it is given', () => {
    const built = newSession(
      { id: 'u1', email: 'e@x.test', name: 'Sam', role: 'STAFF' },
      NOW,
      3600,
    );
    expect(built.iat).toBe(NOW);
    expect(built.exp).toBe(NOW + 3600);
  });
});

describe('login throttling', () => {
  const LIMIT = 5;
  const WINDOW = 5 * 60 * 1000;

  it('locks after the limit is exceeded inside the window', () => {
    let record = registerAttempt(undefined, 0, LIMIT, WINDOW);
    expect(record.locked).toBe(false);
    for (let i = 1; i < LIMIT; i += 1) {
      record = registerAttempt(record.next, i * 1000, LIMIT, WINDOW);
      expect(record.locked).toBe(false);
    }
    record = registerAttempt(record.next, LIMIT * 1000, LIMIT, WINDOW);
    expect(record.locked).toBe(true);
  });

  it('starts a fresh window once the old one has elapsed — the copy promises 5 minutes', () => {
    let record = registerAttempt(undefined, 0, LIMIT, WINDOW);
    for (let i = 0; i < LIMIT + 2; i += 1) {
      record = registerAttempt(record.next, 1000, LIMIT, WINDOW);
    }
    expect(record.locked).toBe(true);
    expect(isLocked(record.next, WINDOW - 1, LIMIT, WINDOW)).toBe(true);
    expect(isLocked(record.next, WINDOW, LIMIT, WINDOW)).toBe(false);
  });

  it('treats an unknown account as unlocked', () => {
    expect(isLocked(undefined, 0, LIMIT, WINDOW)).toBe(false);
  });
});

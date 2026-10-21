import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
} from '@/lib/auth/session';

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || 'songbook-default-secret-change-me');

describe('auth/session.ts', () => {
  it('uses the expected cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('songbook-session');
  });

  it('round-trips a signed session token', async () => {
    const token = await signSessionToken({ id: 'admin', role: 'admin' });
    expect(await verifySessionToken(token)).toEqual({ userId: 'admin', role: 'admin' });
  });

  it('returns null for garbage tokens', async () => {
    expect(await verifySessionToken('not-a-jwt')).toBeNull();
    expect(await verifySessionToken('')).toBeNull();
  });

  it('returns null for tokens signed with a different secret', async () => {
    const token = await new SignJWT({ userId: 'u1', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode('some-other-secret'));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('returns null for tokens with an unknown role', async () => {
    const token = await new SignJWT({ userId: 'u1', role: 'superuser' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret());
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('returns null for tokens without a userId', async () => {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret());
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('returns null for expired tokens', async () => {
    const token = await new SignJWT({ userId: 'u1', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1s')
      .sign(secret());
    await new Promise((r) => setTimeout(r, 1100));
    expect(await verifySessionToken(token)).toBeNull();
  });
});

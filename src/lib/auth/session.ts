import { SignJWT, jwtVerify } from 'jose';
import { roles, type Role } from './schemas';

/**
 * Session token handling kept free of `next/headers` and Node file APIs so it
 * can be shared between request handlers (which read the cookie store) and the
 * `proxy.ts` request interceptor (which verifies a token from a request cookie).
 */

export const SESSION_COOKIE_NAME = 'songbook-session';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'songbook-default-secret-change-me'
);

export interface Session {
  userId: string;
  role: Role;
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (roles as readonly string[]).includes(value);
}

export async function signSessionToken(user: { id: string; role: Role }): Promise<string> {
  return new SignJWT({ userId: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/** Verify a raw session JWT. Returns `null` for malformed, expired or unknown-role tokens. */
export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (typeof payload.userId !== 'string' || !isRole(payload.role)) return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

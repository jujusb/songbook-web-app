// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signSessionToken } from '@/lib/auth/session';
import type { Role } from '@/lib/auth/schemas';

// Node 18 does not expose the Web Crypto API on `globalThis`; jose needs it.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

async function request(
  path: string,
  opts: { method?: string; role?: Role; cookie?: boolean } = {},
) {
  const { method = 'GET', role, cookie = true } = opts;
  const headers: Record<string, string> = {};
  if (cookie && role) {
    headers.cookie = `songbook-session=${await signSessionToken({ id: 'u1', role })}`;
  }
  return new NextRequest(new URL(path, 'http://localhost:3000'), { method, headers });
}

describe('proxy.ts', () => {
  it('redirects unauthenticated visitors from protected pages to /login', async () => {
    const res = await proxy(await request('/admin/users', { cookie: false }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets an admin through to an admin page', async () => {
    const res = await proxy(await request('/admin/users', { role: 'admin' }));
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated API writes with 401 JSON', async () => {
    const res = await proxy(await request('/api/setlists', { method: 'POST', cookie: false }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('rejects non-admin API writes with 403 JSON', async () => {
    const res = await proxy(await request('/api/albums', { method: 'PUT', role: 'reviewer' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('rejects unauthenticated admin-content writes with 403 JSON (matches handler)', async () => {
    const res = await proxy(await request('/api/songs', { method: 'POST', cookie: false }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('permits public reads', async () => {
    const res = await proxy(await request('/api/songs', { cookie: false }));
    expect(res.status).toBe(200);
  });

  it('ignores invalid session cookies as if unauthenticated', async () => {
    const req = new NextRequest(new URL('/api/admin/users', 'http://localhost:3000'), {
      headers: { cookie: 'songbook-session=garbage' },
    });
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it('persists the lang query param as the locale cookie', async () => {
    const res = await proxy(await request('/browse?lang=es', { cookie: false }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('songbook-ui-locale=es');
  });

  it('does not rewrite the locale cookie when it already matches', async () => {
    const req = new NextRequest(new URL('/browse?lang=es', 'http://localhost:3000'), {
      headers: { cookie: 'songbook-ui-locale=es' },
    });
    const res = await proxy(req);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

const { exchangeCode, verifyIdToken, getOidcConfig, resolveRole } = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  verifyIdToken: vi.fn(),
  getOidcConfig: vi.fn(),
  resolveRole: vi.fn(),
}));

const { findOrCreateOidcUser, createSession } = vi.hoisted(() => ({
  findOrCreateOidcUser: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('@/lib/auth/oidc', () => ({
  exchangeCode,
  verifyIdToken,
  getOidcConfig,
  resolveRole,
}));

vi.mock('@/lib/auth', () => ({
  findOrCreateOidcUser,
  createSession,
}));

import { GET } from '@/app/api/auth/oidc/callback/route';

const CALLBACK = 'http://localhost/api/auth/oidc/callback';

function createNextRequest(url: string): NextRequest {
  return { nextUrl: new URL(url), url } as unknown as NextRequest;
}

function configureCookies(storedState?: string) {
  vi.mocked(cookies).mockReturnValue({
    get: vi.fn((name: string) =>
      name === 'oidc-state' ? (storedState ? { value: storedState } : undefined) : undefined
    ),
    set: vi.fn(),
    delete: vi.fn(),
  } as any);
}

const oidcConfig = {
  enabled: true,
  issuer: 'https://idp.example.com',
  clientId: 'client-1',
  scopes: ['openid'],
};

describe('API /api/auth/oidc/callback', () => {
  beforeEach(() => {
    getOidcConfig.mockResolvedValue(oidcConfig);
    configureCookies('state-1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 403 in read-only mode', async () => {
    vi.stubEnv('SONGBOOK_READONLY', '1');
    const response = await GET(createNextRequest(`${CALLBACK}?code=c&state=state-1`));
    expect(response.status).toBe(403);
  });

  it('returns 404 when OIDC is not configured', async () => {
    getOidcConfig.mockResolvedValue(null);
    const response = await GET(createNextRequest(`${CALLBACK}?code=c&state=state-1`));
    expect(response.status).toBe(404);
  });

  it('redirects to login with the provider error', async () => {
    const response = await GET(
      createNextRequest(`${CALLBACK}?error=access_denied&error_description=Denied`)
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?error=Denied');
  });

  it('redirects to login when code or state is missing', async () => {
    const response = await GET(createNextRequest(`${CALLBACK}?code=c`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('Missing');
  });

  it('redirects to login when no state cookie is present', async () => {
    configureCookies(undefined);
    const response = await GET(createNextRequest(`${CALLBACK}?code=c&state=state-1`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('Invalid+state');
  });

  it('redirects to login when the state does not match', async () => {
    configureCookies('different-state');
    const response = await GET(createNextRequest(`${CALLBACK}?code=c&state=state-1`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('Invalid+state');
  });

  it('exchanges the code and creates a session on success', async () => {
    exchangeCode.mockResolvedValue({
      access_token: 'a',
      id_token: 'id-token',
      token_type: 'Bearer',
    });
    verifyIdToken.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      preferred_username: 'user1',
    });
    resolveRole.mockReturnValue('reviewer');
    findOrCreateOidcUser.mockResolvedValue({
      id: 'oidc-user-1',
      username: 'user1',
      role: 'reviewer',
    });
    createSession.mockResolvedValue('session-token');

    const response = await GET(createNextRequest(`${CALLBACK}?code=code-1&state=state-1`));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/browse');
    expect(exchangeCode).toHaveBeenCalledWith(
      'code-1',
      'http://localhost/api/auth/oidc/callback'
    );
    expect(findOrCreateOidcUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ email: 'user@example.com', name: 'User One' }),
      'reviewer'
    );
    expect(response.headers.get('set-cookie')).toContain('songbook-session=session-token');
  });

  it('redirects to login when the ID token has no sub claim', async () => {
    exchangeCode.mockResolvedValue({
      access_token: 'a',
      id_token: 'id-token',
      token_type: 'Bearer',
    });
    verifyIdToken.mockResolvedValue({});

    const response = await GET(createNextRequest(`${CALLBACK}?code=code-1&state=state-1`));

    expect(response.status).toBe(307);
    expect(decodeURIComponent(response.headers.get('location')!)).toContain('missing sub claim');
  });

  it('redirects to login when the token exchange fails', async () => {
    exchangeCode.mockRejectedValue(new Error('bad code'));

    const response = await GET(createNextRequest(`${CALLBACK}?code=code-1&state=state-1`));

    expect(response.status).toBe(307);
    expect(decodeURIComponent(response.headers.get('location')!)).toContain('bad code');
  });
});

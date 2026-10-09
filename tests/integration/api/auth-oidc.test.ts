import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

const { getOidcConfig, buildAuthorizationUrl } = vi.hoisted(() => ({
  getOidcConfig: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
}));

vi.mock('@/lib/auth/oidc', () => ({ getOidcConfig, buildAuthorizationUrl }));

import { GET } from '@/app/api/auth/oidc/route';

function createNextRequest(url = 'http://localhost/api/auth/oidc'): NextRequest {
  return { nextUrl: new URL(url), url } as unknown as NextRequest;
}

describe('API /api/auth/oidc', () => {
  let setCookie: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setCookie = vi.fn();
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(),
      set: setCookie,
      delete: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 403 in read-only mode', async () => {
    vi.stubEnv('SONGBOOK_READONLY', '1');
    const response = await GET(createNextRequest());
    expect(response.status).toBe(403);
    expect(getOidcConfig).not.toHaveBeenCalled();
  });

  it('returns 404 when OIDC is not configured', async () => {
    getOidcConfig.mockResolvedValue(null);
    const response = await GET(createNextRequest());
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toContain('not configured');
  });

  it('redirects to the authorization URL and stores state', async () => {
    getOidcConfig.mockResolvedValue({
      enabled: true,
      issuer: 'https://idp.example.com',
      clientId: 'client-1',
      scopes: ['openid', 'profile'],
    });
    buildAuthorizationUrl.mockResolvedValue({
      url: 'https://idp.example.com/authorize?client_id=client-1',
      state: 'state-xyz',
    });

    const response = await GET(createNextRequest('http://localhost:3100/api/auth/oidc'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://idp.example.com/authorize?client_id=client-1'
    );
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      'http://localhost:3100/api/auth/oidc/callback'
    );
    expect(setCookie).toHaveBeenCalledWith(
      'oidc-state',
      'state-xyz',
      expect.objectContaining({ httpOnly: true, path: '/', maxAge: 600 })
    );
  });
});

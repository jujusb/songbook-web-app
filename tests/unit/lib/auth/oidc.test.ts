import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { JWTPayload } from 'jose';
import type { OidcConfig } from '@/lib/content/schemas';

const { getSiteConfigMock, createRemoteJWKSetMock, jwtVerifyMock } = vi.hoisted(() => ({
  getSiteConfigMock: vi.fn(),
  createRemoteJWKSetMock: vi.fn(),
  jwtVerifyMock: vi.fn(),
}));

vi.mock('@/lib/content', () => ({
  getSiteConfig: getSiteConfigMock,
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: createRemoteJWKSetMock,
  jwtVerify: jwtVerifyMock,
}));

const ISSUER = 'https://auth.example.com';

const baseOidcConfig: OidcConfig = {
  enabled: true,
  issuer: ISSUER,
  clientId: 'test-client',
  scopes: ['openid', 'profile', 'email'],
  roleClaim: 'groups',
  defaultRole: 'public',
  buttonLabel: 'Sign in with SSO',
  autoRedirect: false,
};

const discoveryDocument = {
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  jwks_uri: `${ISSUER}/jwks`,
  userinfo_endpoint: `${ISSUER}/userinfo`,
  issuer: ISSUER,
};

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function stubFetch(...responses: Array<Response | (() => Response)>) {
  const fn = vi.fn();
  for (const response of responses) {
    fn.mockImplementationOnce(async () =>
      typeof response === 'function' ? response() : response
    );
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

function configureOidc(overrides: Partial<OidcConfig> = {}) {
  getSiteConfigMock.mockResolvedValue({
    title: 'Test Songbook',
    defaultLanguage: 'en',
    oidc: { ...baseOidcConfig, ...overrides },
  });
}

describe('auth/oidc.ts', () => {
  let oidcModule: typeof import('@/lib/auth/oidc');

  beforeEach(async () => {
    vi.resetModules();
    getSiteConfigMock.mockReset();
    createRemoteJWKSetMock.mockReset();
    jwtVerifyMock.mockReset();
    oidcModule = await import('@/lib/auth/oidc');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('getDiscovery', () => {
    it('fetches and returns the discovery document', async () => {
      const fetchMock = stubFetch(jsonResponse(discoveryDocument));

      const result = await oidcModule.getDiscovery(ISSUER);

      expect(result).toEqual(discoveryDocument);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${ISSUER}/.well-known/openid-configuration`,
        { next: { revalidate: 3600 } }
      );
    });

    it('strips trailing slashes from the issuer before building the URL', async () => {
      const fetchMock = stubFetch(jsonResponse(discoveryDocument));

      await oidcModule.getDiscovery(`${ISSUER}///`);

      expect(fetchMock).toHaveBeenCalledWith(
        `${ISSUER}/.well-known/openid-configuration`,
        { next: { revalidate: 3600 } }
      );
    });

    it('throws when discovery responds with a non-ok status', async () => {
      stubFetch(jsonResponse({}, { ok: false, status: 404, statusText: 'Not Found' }));

      await expect(oidcModule.getDiscovery(ISSUER)).rejects.toThrow(
        'OIDC discovery failed: 404 Not Found'
      );
    });

    it('caches the discovery document across calls', async () => {
      const fetchMock = stubFetch(jsonResponse(discoveryDocument));

      await oidcModule.getDiscovery(ISSUER);
      await oidcModule.getDiscovery(ISSUER);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOidcConfig', () => {
    it('returns null when site config has no oidc block', async () => {
      getSiteConfigMock.mockResolvedValue({ title: 'Test', defaultLanguage: 'en' });

      await expect(oidcModule.getOidcConfig()).resolves.toBeNull();
    });

    it('returns null when oidc is disabled', async () => {
      getSiteConfigMock.mockResolvedValue({
        title: 'Test',
        defaultLanguage: 'en',
        oidc: { ...baseOidcConfig, enabled: false },
      });

      await expect(oidcModule.getOidcConfig()).resolves.toBeNull();
    });

    it('returns the oidc config when enabled', async () => {
      configureOidc();

      await expect(oidcModule.getOidcConfig()).resolves.toEqual(baseOidcConfig);
    });

    it('returns null when reading the site config throws', async () => {
      getSiteConfigMock.mockRejectedValue(new Error('disk failure'));

      await expect(oidcModule.getOidcConfig()).resolves.toBeNull();
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('builds a URL with the expected PKCE-less query params and a random state', async () => {
      configureOidc();
      stubFetch(jsonResponse(discoveryDocument));

      const { url, state } = await oidcModule.buildAuthorizationUrl(
        'http://localhost/api/auth/oidc/callback'
      );

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(`${ISSUER}/authorize`);
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('test-client');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost/api/auth/oidc/callback'
      );
      expect(parsed.searchParams.get('scope')).toBe('openid profile email');
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates a different state on each call', async () => {
      configureOidc();
      stubFetch(jsonResponse(discoveryDocument), jsonResponse(discoveryDocument));

      const first = await oidcModule.buildAuthorizationUrl('http://localhost/cb');
      // Force a fresh module instance so the discovery cache does not mask the call.
      vi.resetModules();
      oidcModule = await import('@/lib/auth/oidc');
      configureOidc();

      const second = await oidcModule.buildAuthorizationUrl('http://localhost/cb');

      expect(first.state).not.toBe(second.state);
    });

    it('throws when OIDC is not configured', async () => {
      getSiteConfigMock.mockResolvedValue({ title: 'Test', defaultLanguage: 'en' });

      await expect(
        oidcModule.buildAuthorizationUrl('http://localhost/cb')
      ).rejects.toThrow('OIDC is not configured');
    });
  });

  describe('exchangeCode', () => {
    it('posts the code and returns the token response', async () => {
      vi.stubEnv('OIDC_CLIENT_SECRET', 'super-secret');
      configureOidc();

      const tokenResponse = {
        access_token: 'access-token',
        id_token: 'id-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      const fetchMock = stubFetch(
        jsonResponse(discoveryDocument),
        jsonResponse(tokenResponse)
      );

      const result = await oidcModule.exchangeCode('auth-code', 'http://localhost/cb');

      expect(result).toEqual(tokenResponse);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [tokenUrl, tokenInit] = fetchMock.mock.calls[1];
      expect(tokenUrl).toBe(`${ISSUER}/token`);
      expect(tokenInit).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const body = new URLSearchParams(tokenInit.body as string);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('auth-code');
      expect(body.get('redirect_uri')).toBe('http://localhost/cb');
      expect(body.get('client_id')).toBe('test-client');
      expect(body.get('client_secret')).toBe('super-secret');
    });

    it('includes the client secret from the environment', async () => {
      vi.stubEnv('OIDC_CLIENT_SECRET', 'from-env');
      configureOidc();

      const fetchMock = stubFetch(
        jsonResponse(discoveryDocument),
        jsonResponse({ access_token: 'a', id_token: 'b', token_type: 'Bearer' })
      );

      await oidcModule.exchangeCode('code', 'http://localhost/cb');

      const body = new URLSearchParams(fetchMock.mock.calls[1][1].body as string);
      expect(body.get('client_secret')).toBe('from-env');
    });

    it('throws when OIDC is not configured', async () => {
      getSiteConfigMock.mockResolvedValue({ title: 'Test', defaultLanguage: 'en' });

      await expect(oidcModule.exchangeCode('code', 'http://localhost/cb')).rejects.toThrow(
        'OIDC is not configured'
      );
    });

    it('throws when OIDC_CLIENT_SECRET is missing', async () => {
      vi.stubEnv('OIDC_CLIENT_SECRET', '');
      configureOidc();
      stubFetch(jsonResponse(discoveryDocument));

      await expect(oidcModule.exchangeCode('code', 'http://localhost/cb')).rejects.toThrow(
        'OIDC_CLIENT_SECRET env var is required when OIDC is enabled'
      );
    });

    it('throws with the response body when the token endpoint fails', async () => {
      vi.stubEnv('OIDC_CLIENT_SECRET', 'super-secret');
      configureOidc();

      stubFetch(
        jsonResponse(discoveryDocument),
        jsonResponse('invalid_grant', { ok: false, status: 400, statusText: 'Bad Request' })
      );

      await expect(oidcModule.exchangeCode('code', 'http://localhost/cb')).rejects.toThrow(
        'Token exchange failed: 400 invalid_grant'
      );
    });
  });

  describe('verifyIdToken', () => {
    it('verifies the token against the remote JWKS with issuer and audience', async () => {
      configureOidc();
      const fetchMock = stubFetch(jsonResponse(discoveryDocument));

      const jwks = { jwks: true };
      createRemoteJWKSetMock.mockReturnValue(jwks);
      const payload: JWTPayload = { sub: 'user-1', email: 'user@example.com' };
      jwtVerifyMock.mockResolvedValue({ payload, protectedHeader: { alg: 'RS256' } });

      const result = await oidcModule.verifyIdToken('the.id.token');

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1);
      const jwksUrl = createRemoteJWKSetMock.mock.calls[0][0] as URL;
      expect(jwksUrl.toString()).toBe(`${ISSUER}/jwks`);
      expect(jwtVerifyMock).toHaveBeenCalledWith('the.id.token', jwks, {
        issuer: ISSUER,
        audience: 'test-client',
      });
    });

    it('throws when OIDC is not configured', async () => {
      getSiteConfigMock.mockResolvedValue({ title: 'Test', defaultLanguage: 'en' });

      await expect(oidcModule.verifyIdToken('the.id.token')).rejects.toThrow(
        'OIDC is not configured'
      );
    });

    it('propagates verification errors from jose', async () => {
      configureOidc();
      stubFetch(jsonResponse(discoveryDocument));
      jwtVerifyMock.mockRejectedValue(new Error('signature verification failed'));

      await expect(oidcModule.verifyIdToken('the.id.token')).rejects.toThrow(
        'signature verification failed'
      );
    });
  });

  describe('resolveRole', () => {
    it('returns the default role when the claim is absent', () => {
      const role = oidcModule.resolveRole({ sub: 'u1' }, { ...baseOidcConfig, defaultRole: 'reviewer' });
      expect(role).toBe('reviewer');
    });

    it('returns the default role when no role mapping is configured', () => {
      const role = oidcModule.resolveRole(
        { sub: 'u1', groups: ['songbook-admins'] },
        { ...baseOidcConfig, defaultRole: 'reviewer' }
      );
      expect(role).toBe('reviewer');
    });

    it('falls back to public when defaultRole is not set', () => {
      const config = { ...baseOidcConfig } as OidcConfig;
      delete (config as Partial<OidcConfig>).defaultRole;
      expect(oidcModule.resolveRole({ sub: 'u1' }, config)).toBe('public');
    });

    it('maps an array claim value to admin', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleClaim: 'roles',
        roleMapping: { admin: ['songbook-admin', 'admin'], reviewer: ['songbook-reviewer'] },
      };
      const role = oidcModule.resolveRole({ sub: 'u1', roles: ['other', 'songbook-admin'] }, config);
      expect(role).toBe('admin');
    });

    it('maps a string claim value to admin', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleMapping: { admin: ['songbook-admin'], reviewer: ['songbook-reviewer'] },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: 'songbook-admin' }, config)).toBe('admin');
    });

    it('prefers admin over reviewer when both match', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleMapping: { admin: ['admin'], reviewer: ['reviewer'] },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: ['admin', 'reviewer'] }, config)).toBe(
        'admin'
      );
    });

    it('maps to reviewer when only the reviewer value matches', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleMapping: { admin: ['admin'], reviewer: ['reviewer'] },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: ['reviewer'] }, config)).toBe('reviewer');
    });

    it('maps a single string admin value', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleMapping: { admin: 'songbook-admin' },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: 'songbook-admin' }, config)).toBe('admin');
    });

    it('maps a single string reviewer value', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleMapping: { reviewer: 'reviewer' },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: 'reviewer' }, config)).toBe('reviewer');
    });

    it('returns the default role when no mapped value matches', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        defaultRole: 'public',
        roleMapping: { admin: ['admin'], reviewer: ['reviewer'] },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: ['unrelated'] }, config)).toBe('public');
    });

    it('uses a custom roleClaim', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleClaim: 'entitlements',
        roleMapping: { admin: ['songbook-admin'] },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', entitlements: ['songbook-admin'] }, config)).toBe(
        'admin'
      );
    });

    it('ignores non-matching claims on a different claim key', () => {
      const config: OidcConfig = {
        ...baseOidcConfig,
        roleClaim: 'entitlements',
        roleMapping: { admin: ['songbook-admin'] },
      };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: ['songbook-admin'] }, config)).toBe(
        'public'
      );
    });

    it('returns the default role when the mapping is empty', () => {
      const config: OidcConfig = { ...baseOidcConfig, roleMapping: {} };
      expect(oidcModule.resolveRole({ sub: 'u1', groups: ['admin'] }, config)).toBe('public');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { JWTPayload } from 'jose';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getSiteConfig } from '@/lib/content';
import { createTempContentDir } from '../../../utils/temp-content';

vi.mock('@/lib/content', () => ({
  getSiteConfig: vi.fn(),
}));

describe('auth/oidc.ts', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let oidcModule: typeof import('@/lib/auth/oidc');
  
  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    oidcModule = await import('@/lib/auth/oidc');
    vi.clearAllMocks();
  });
  
  afterEach(async () => {
    if (tempDir) {
      await tempDir.cleanup();
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const mockFetch = (response: any) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: response.ok !== false,
      status: response.status || 200,
      statusText: response.statusText || 'OK',
      json: async () => response.json,
      text: async () => response.text || JSON.stringify(response.json),
    } as any));
  };

  describe('getDiscovery', () => {
    it('fetches discovery document', async () => {
      const discovery = {
        authorization_endpoint: 'https://auth.example.com/auth',
        token_endpoint: 'https://auth.example.com/token',
        jwks_uri: 'https://auth.example.com/jwks',
        userinfo_endpoint: 'https://auth.example.com/userinfo',
        issuer: 'https://auth.example.com',
      };
      mockFetch({ json: discovery });
      
      const result = await oidcModule.getDiscovery('https://auth.example.com');
      expect(result).toEqual(discovery);
    });

    it('normalizes issuer with trailing slash', async () => {
      const discovery = {
        authorization_endpoint: 'https://auth.example.com/auth',
        token_endpoint: 'https://auth.example.com/token',
        jwks_uri: 'https://auth.example.com/jwks',
        issuer: 'https://auth.example.com/',
      };
      mockFetch({ json: discovery });
      
      await oidcModule.getDiscovery('https://auth.example.com/');
      const fetchMock = global.fetch as any;
      expect(fetchMock).toHaveBeenCalledWith(
        'https://auth.example.com/.well-known/openid-configuration',
        expect.any(Object)
      );
    });

    it('throws on failed discovery', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' });
      
      await expect(oidcModule.getDiscovery('https://bad.example.com'))
        .rejects.toThrow('OIDC discovery failed: 404 Not Found');
    });

    it('caches discovery result', async () => {
      const discovery = {
        authorization_endpoint: 'https://auth.example.com/auth',
        token_endpoint: 'https://auth.example.com/token',
        jwks_uri: 'https://auth.example.com/jwks',
        issuer: 'https://auth.example.com',
      };
      mockFetch({ json: discovery });
      
      await oidcModule.getDiscovery('https://auth.example.com');
      await oidcModule.getDiscovery('https://auth.example.com');
      const fetchMock = global.fetch as any;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOidcConfig', () => {
    it('returns null when OIDC is disabled', async () => {
      vi.mocked(getSiteConfig).mockResolvedValue({
        title: 'Test',
        defaultLanguage: 'en',
      } as any);
      const config = await oidcModule.getOidcConfig();
      expect(config).toBeNull();
    });

    it('returns the oidc block when enabled', async () => {
      vi.mocked(getSiteConfig).mockResolvedValue({
        title: 'Test',
        defaultLanguage: 'en',
        oidc: {
          enabled: true,
          issuer: 'https://idp.example.com',
          clientId: 'client-1',
          scopes: ['openid'],
        },
      } as any);
      const config = await oidcModule.getOidcConfig();
      expect(config?.issuer).toBe('https://idp.example.com');
    });

    it('returns null when the site config throws', async () => {
      vi.mocked(getSiteConfig).mockRejectedValue(new Error('no config'));
      const config = await oidcModule.getOidcConfig();
      expect(config).toBeNull();
    });
  });

  describe('resolveRole', () => {
    const oidc: any = { roleClaim: 'groups', defaultRole: 'public' };

    it('returns the default role when no mapping is configured', () => {
      expect(oidcModule.resolveRole({} as JWTPayload, oidc)).toBe('public');
    });

    it('maps an admin group to the admin role', () => {
      const config: any = {
        roleClaim: 'groups',
        roleMapping: { admin: ['admins'] },
        defaultRole: 'public',
      };
      expect(oidcModule.resolveRole({ groups: ['admins'] } as JWTPayload, config)).toBe('admin');
    });

    it('maps a reviewer group to the reviewer role', () => {
      const config: any = {
        roleClaim: 'groups',
        roleMapping: { reviewer: ['reviewers'] },
        defaultRole: 'public',
      };
      expect(oidcModule.resolveRole({ groups: 'reviewers' } as JWTPayload, config)).toBe('reviewer');
    });

    it('falls back to the default role for unknown groups', () => {
      const config: any = {
        roleClaim: 'groups',
        roleMapping: { admin: ['admins'], reviewer: ['reviewers'] },
        defaultRole: 'setlist_creator',
      };
      expect(oidcModule.resolveRole({ groups: ['guests'] } as JWTPayload, config)).toBe(
        'setlist_creator'
      );
    });
  });
});

  describe('getOidcConfig', () => {
    it('returns null if OIDC not enabled', async () => {
      vi.mocked(getSiteConfig).mockResolvedValue({
        title: 'Test',
        defaultLanguage: 'en',
        oidc: { enabled: false } as any,
      });
      
      const result = await oidcModule.getOidcConfig();
      expect(result).toBeNull();
    });

    it('returns null if no oidc config', async () => {
      vi.mocked(getSiteConfig).mockResolvedValue({
        title: 'Test',
        defaultLanguage: 'en',
      });
      
      const result = await oidcModule.getOidcConfig();
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      vi.mocked(getSiteConfig).mockRejectedValue(new Error('fail'));
      
      const result = await oidcModule.getOidcConfig();
      expect(result).toBeNull();
    });

    it('returns OIDC config when enabled', async () => {
      const oidcConfig = {
        enabled: true,
        issuer: 'https://auth.example.com',
        clientId: 'test-client',
        scopes: ['openid', 'profile'],
        roleClaim: 'groups',
        defaultRole: 'public' as const,
        buttonLabel: 'Sign in',
        autoRedirect: false,
      };
      vi.mocked(getSiteConfig).mockResolvedValue({
        title: 'Test',
        defaultLanguage: 'en',
        oidc: oidcConfig,
      });
      
      const result = await oidcModule.getOidcConfig();
      expect(result).toEqual(oidcConfig);
    });
  });

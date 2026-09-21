import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getSiteConfig } from '@/lib/content';
import type { OidcConfig } from '@/lib/content/schemas';
import type { Role } from './schemas';
import crypto from 'crypto';

// ---- OIDC Discovery ----

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  issuer: string;
}

let discoveryCache: { config: OidcDiscovery; expires: number } | null = null;

export async function getDiscovery(issuer: string): Promise<OidcDiscovery> {
  if (discoveryCache && Date.now() < discoveryCache.expires) {
    return discoveryCache.config;
  }

  const url = `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  }
  const config = (await res.json()) as OidcDiscovery;
  discoveryCache = { config, expires: Date.now() + 3600_000 };
  return config;
}

// ---- OIDC Config helpers ----

export async function getOidcConfig(): Promise<OidcConfig | null> {
  try {
    const site = await getSiteConfig();
    if (!site.oidc?.enabled) return null;
    return site.oidc;
  } catch {
    return null;
  }
}

function getClientSecret(): string {
  const secret = process.env.OIDC_CLIENT_SECRET;
  if (!secret) throw new Error('OIDC_CLIENT_SECRET env var is required when OIDC is enabled');
  return secret;
}

// ---- Authorization URL ----

export async function buildAuthorizationUrl(redirectUri: string): Promise<{ url: string; state: string }> {
  const oidc = await getOidcConfig();
  if (!oidc) throw new Error('OIDC is not configured');

  const discovery = await getDiscovery(oidc.issuer);

  const state = crypto.randomBytes(32).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: oidc.clientId,
    redirect_uri: redirectUri,
    scope: oidc.scopes.join(' '),
    state,
  });

  return {
    url: `${discovery.authorization_endpoint}?${params.toString()}`,
    state,
  };
}

// ---- Token Exchange ----

interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const oidc = await getOidcConfig();
  if (!oidc) throw new Error('OIDC is not configured');

  const discovery = await getDiscovery(oidc.issuer);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: oidc.clientId,
    client_secret: getClientSecret(),
  });

  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as TokenResponse;
}

// ---- ID Token Verification ----

export async function verifyIdToken(idToken: string): Promise<JWTPayload> {
  const oidc = await getOidcConfig();
  if (!oidc) throw new Error('OIDC is not configured');

  const discovery = await getDiscovery(oidc.issuer);
  const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: discovery.issuer,
    audience: oidc.clientId,
  });

  return payload;
}

// ---- Role Resolution ----

export function resolveRole(claims: JWTPayload, oidc: OidcConfig): Role {
  const roleClaim = oidc.roleClaim || 'groups';
  const claimValue = claims[roleClaim];

  if (!claimValue || !oidc.roleMapping) {
    return oidc.defaultRole || 'public';
  }

  // Normalize claim value to an array of strings
  const values: string[] = Array.isArray(claimValue)
    ? claimValue.map(String)
    : [String(claimValue)];

  // Check admin mapping first (highest privilege)
  if (oidc.roleMapping.admin) {
    const adminValues = Array.isArray(oidc.roleMapping.admin)
      ? oidc.roleMapping.admin
      : [oidc.roleMapping.admin];
    if (adminValues.some((v) => values.includes(v))) return 'admin';
  }

  // Then reviewer
  if (oidc.roleMapping.reviewer) {
    const reviewerValues = Array.isArray(oidc.roleMapping.reviewer)
      ? oidc.roleMapping.reviewer
      : [oidc.roleMapping.reviewer];
    if (reviewerValues.some((v) => values.includes(v))) return 'reviewer';
  }

  return oidc.defaultRole || 'public';
}

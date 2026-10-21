import type { Role } from './schemas';

/**
 * Pure access-control rules shared with the `proxy.ts` request interceptor.
 *
 * This is intentionally framework-agnostic so it can be unit tested without a
 * Next.js request and so the proxy stays free of heavy modules. It centralizes
 * the *coarse* authentication + role gating for routes and pages. It does not
 * (and cannot) replace the resource-level authorization that stays in the
 * route handlers and server actions — ownership, share tokens, per-song or
 * per-language permissions, and read-only operation granularity.
 *
 * Next.js explicitly warns that a proxy must not be the sole authorization
 * layer, so handlers keep their own checks as defense-in-depth.
 */

export interface GuardSession {
  userId: string;
  role: Role;
}

export interface GuardInput {
  pathname: string;
  method: string;
  searchParams: Pick<URLSearchParams, 'get'>;
}

export type GuardResult =
  | { type: 'next' }
  | { type: 'json'; status: 401 | 403; error: string }
  | { type: 'redirect'; location: string };

const UNAUTHORIZED: GuardResult = { type: 'json', status: 401, error: 'Unauthorized' };
const FORBIDDEN: GuardResult = { type: 'json', status: 403, error: 'Forbidden' };
const LOGIN_REDIRECT: GuardResult = { type: 'redirect', location: '/login' };

const isAdmin = (session: GuardSession | null): boolean => session?.role === 'admin';
const canEdit = (session: GuardSession | null): boolean =>
  session?.role === 'reviewer' || session?.role === 'admin';
const canSetlist = (session: GuardSession | null): boolean =>
  session?.role === 'setlist_creator' || session?.role === 'reviewer' || session?.role === 'admin';

function evaluateApi(
  pathname: string,
  method: string,
  searchParams: Pick<URLSearchParams, 'get'>,
  session: GuardSession | null,
): GuardResult | null {
  // User administration.
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    return isAdmin(session) ? null : UNAUTHORIZED;
  }

  // Revision history and publish/revert all need at least the reviewer floor.
  // Per-song / per-language permissions stay in the handler.
  if (/^\/api\/songs\/[^/]+\/revisions(\/.*)?$/.test(pathname)) {
    return canEdit(session) ? null : UNAUTHORIZED;
  }

  // Albums, artists and songs: reads are public (except `?all=true`), writes
  // are admin-only. This closes routes that previously relied on read-only
  // mode alone.
  if (pathname === '/api/albums' || pathname === '/api/artists' || pathname === '/api/songs') {
    if (method === 'GET') {
      if (searchParams.get('all') === 'true' && !isAdmin(session)) return UNAUTHORIZED;
      return null;
    }
    return isAdmin(session) ? null : FORBIDDEN;
  }

  // Setlists: reads are public (visibility filtered in the handler); writes
  // need a setlist-capable role. Ownership is enforced in the handler.
  if (pathname === '/api/setlists') {
    if (method === 'GET') return null;
    return canSetlist(session) ? null : UNAUTHORIZED;
  }

  return null;
}

function evaluatePage(pathname: string, session: GuardSession | null): GuardResult | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return isAdmin(session) ? null : LOGIN_REDIRECT;
  }

  if (
    pathname === '/import' ||
    pathname === '/songs/new' ||
    pathname === '/artists/new' ||
    pathname === '/albums/new' ||
    /^\/albums\/[^/]+\/edit$/.test(pathname) ||
    /^\/edit\/[^/]+\/[^/]+$/.test(pathname)
  ) {
    return canEdit(session) ? null : LOGIN_REDIRECT;
  }

  if (pathname === '/setlists/new') {
    return canSetlist(session) ? null : LOGIN_REDIRECT;
  }

  if (pathname === '/profile') {
    return session ? null : LOGIN_REDIRECT;
  }

  // Signed-in visitors do not need the auth pages.
  if (pathname === '/login') {
    return session ? { type: 'redirect', location: '/browse' } : null;
  }
  if (pathname === '/register') {
    return session ? { type: 'redirect', location: '/setlists/new' } : null;
  }

  return null;
}

/**
 * Decide what the proxy should do for a request. Returns `{ type: 'next' }`
 * when no centralized rule applies (the handler remains the authority).
 */
export function evaluateAccess(input: GuardInput, session: GuardSession | null): GuardResult {
  return (
    evaluateApi(input.pathname, input.method, input.searchParams, session) ??
    evaluatePage(input.pathname, session) ??
    { type: 'next' }
  );
}

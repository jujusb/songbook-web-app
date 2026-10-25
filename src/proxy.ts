import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import { evaluateAccess } from '@/lib/auth/route-guard';

import { getSetlistLinkAllowedHosts, getSetlistLinkAllowHttp, getNavidromeFrameOrigins } from '@/lib/config';

const LOCALE_COOKIE = 'songbook-ui-locale';
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

/**
 * Request interceptor (the Next.js 16 rename of `middleware`).
 *
 * Responsibilities:
 * - Persist the `lang` query param as the `songbook-ui-locale` cookie.
 * - Centralize coarse authentication + role gating for protected pages and API
 *   routes via `evaluateAccess`.
 *
 * Resource-level authorization (setlist ownership, share tokens, per-song /
 * per-language permissions) and read-only handling intentionally stay in the
 * route handlers and server actions, per the Next.js data-security guidance.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const lang = searchParams.get('lang');
  const shouldSetLocale =
    !!lang &&
    LOCALE_PATTERN.test(lang) &&
    request.cookies.get(LOCALE_COOKIE)?.value !== lang;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const decision = evaluateAccess(
    { pathname, method: request.method, searchParams },
    session,
  );

  if (decision.type === 'redirect') {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }
  if (decision.type === 'json') {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', buildCsp());
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (shouldSetLocale && lang) {
    response.cookies.set(LOCALE_COOKIE, lang, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
  }
  return response;
}

function buildCsp(): string {
  const frameSrc = new Set<string>(["'self'", 'blob:', 'https://open.spotify.com', 'https://www.youtube.com', 'https://www.youtube-nocookie.com']);
  for (const v of [process.env.SONGBOOK_NAVIDROME_SONGS_URL, process.env.SONGBOOK_VOICES_NAVIDROME_SONGS_URL]) {
    if (!v) continue;
    try { frameSrc.add(new URL(v).origin); } catch { /* ignore invalid */ }
  }
  // Public Navidrome share hosts often differ from the API URLs above.
  for (const o of getNavidromeFrameOrigins()) frameSrc.add(o);
  const allowHttp = getSetlistLinkAllowHttp();
  for (const h of getSetlistLinkAllowedHosts()) {
    frameSrc.add(`https://${h}`);
    if (allowHttp) frameSrc.add(`http://${h}`);
  }
  return [
    `frame-src ${[...frameSrc].join(' ')}`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

export const config = {
  matcher: [
    /*
     * Pages: everything except API routes, static assets and metadata files.
     * Gated API routes are listed explicitly below.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|public).*)',
    '/api/admin/:path*',
    '/api/albums/:path*',
    '/api/artists/:path*',
    '/api/songs/:path*',
    '/api/setlists/:path*',
  ],
};

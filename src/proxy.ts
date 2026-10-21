import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import { evaluateAccess } from '@/lib/auth/route-guard';

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
  if (shouldSetLocale && lang) {
    response.cookies.set(LOCALE_COOKIE, lang, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
  }
  return response;
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

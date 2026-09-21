import { NextResponse, type NextRequest } from 'next/server';
import { buildAuthorizationUrl, getOidcConfig } from '@/lib/auth/oidc';
import { cookies } from 'next/headers';
import { isReadOnly } from '@/lib/readonly';

export async function GET(request: NextRequest) {
  if (isReadOnly()) {
    return NextResponse.json({ error: 'Read-only mode' }, { status: 403 });
  }
  const oidc = await getOidcConfig();
  if (!oidc) {
    return NextResponse.json({ error: 'OIDC is not configured' }, { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/oidc/callback`;

  const { url, state } = await buildAuthorizationUrl(redirectUri);

  // Store state in a short-lived cookie to verify on callback
  const cookieStore = await cookies();
  cookieStore.set('oidc-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return NextResponse.redirect(url);
}

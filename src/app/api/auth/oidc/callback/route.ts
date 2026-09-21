import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, verifyIdToken, getOidcConfig, resolveRole } from '@/lib/auth/oidc';
import { findOrCreateOidcUser, createSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const oidc = await getOidcConfig();
  if (!oidc) {
    return NextResponse.json({ error: 'OIDC is not configured' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle provider-side errors
  if (error) {
    const message = errorDescription || error;
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.nextUrl.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/login?error=Missing+code+or+state', request.nextUrl.origin)
    );
  }

  // Verify state matches what we stored
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oidc-state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL('/login?error=Invalid+state+parameter', request.nextUrl.origin)
    );
  }

  // Clear the state cookie
  cookieStore.set('oidc-state', '', { maxAge: 0, path: '/' });

  try {
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/oidc/callback`;

    // Exchange authorization code for tokens
    const tokens = await exchangeCode(code, redirectUri);

    // Verify and decode the ID token
    const claims = await verifyIdToken(tokens.id_token);

    if (!claims.sub) {
      throw new Error('ID token missing sub claim');
    }

    // Resolve role from claims
    const role = resolveRole(claims, oidc);

    // Find or create user
    const user = await findOrCreateOidcUser(claims.sub, {
      email: claims.email as string | undefined,
      name: claims.name as string | undefined,
      preferred_username: claims.preferred_username as string | undefined,
    }, role);

    // Create local session
    const token = await createSession(user);

    const response = NextResponse.redirect(new URL('/browse', origin));
    response.cookies.set('songbook-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OIDC login failed';
    console.error('OIDC callback error:', message);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.nextUrl.origin)
    );
  }
}

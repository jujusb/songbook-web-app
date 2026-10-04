import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang');
  
  // Only redirect if lang param is present and valid
  if (lang && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang)) {
    // Check if the lang cookie is already set correctly
    const cookieLang = request.cookies.get('songbook-ui-locale')?.value;
    
    if (cookieLang !== lang) {
      const response = NextResponse.next();
      response.cookies.set('songbook-ui-locale', lang, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
      return response;
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIX = [
  '/dashboard',
  '/orders',
  '/inventory',
  '/reports',
  '/integrations',
  '/customers',
  '/payments',
  '/settings'
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('rekart_token')?.value;
  const isProtected = PROTECTED_PREFIX.some(p => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if ((pathname === '/forgot-password' || pathname === '/reset-password') && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname === '/' && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|rekart-logo.svg|.*\\.svg).*)']
};

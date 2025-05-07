import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // Only apply to paths that start with /__/auth/
  if (url.pathname.startsWith('/__/auth/')) {
    // This is handled by the rewrites in next.config.mjs
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/__/auth/:path*',
};
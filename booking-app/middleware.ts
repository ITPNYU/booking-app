import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle auth paths
  if (pathname.startsWith('/__/auth/')) {
    return NextResponse.next();
  }

  // Skip if already starts with /mc or /itp
  if (pathname.startsWith("/mc") || pathname.startsWith("/itp")) {
    return NextResponse.next();
  }

  // Skip API routes and static files
  if (
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname.startsWith("/$dash")
  ) {
    return NextResponse.next();
  }

  // Redirect all other routes to /mc prefixed version
  const redirectUrl = new URL(`/mc${pathname}`, request.url);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    '/__/auth/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ],
};

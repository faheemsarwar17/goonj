import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                      request.nextUrl.pathname.startsWith('/signup')
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard') ||
                       request.nextUrl.pathname.startsWith('/sessions') ||
                       request.nextUrl.pathname.startsWith('/admin')

  // Redirect to login if accessing protected route without token
  if (isDashboard && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to dashboard if accessing auth pages with token
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/sessions/:path*', '/admin/:path*', '/login', '/signup']
}

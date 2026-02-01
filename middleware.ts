import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    process.env.FRONTEND_URL || '',
    process.env.NEXT_PUBLIC_FRONTEND_URL || '',
  ].filter(Boolean);

  const isAllowedOrigin = allowedOrigins.includes(origin) || origin === '*';
  const allowOrigin = isAllowedOrigin ? origin : (allowedOrigins[0] || '*');

  if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
          status: 204,
          headers: {
              'Access-Control-Allow-Origin': allowOrigin,
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cookie, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
              'Access-Control-Max-Age': '86400',
              'Access-Control-Allow-Credentials': 'true',
          },
      });
  }

  const response = NextResponse.next();
  
  response.headers.set('Access-Control-Allow-Origin', allowOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cookie, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

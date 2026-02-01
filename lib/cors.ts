import { NextResponse } from 'next/server';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  process.env.FRONTEND_URL || '',
  process.env.NEXT_PUBLIC_FRONTEND_URL || '',
].filter(Boolean);

export function corsHeaders(origin?: string | null) {
  const requestOrigin = origin || '*';
  const isAllowed = allowedOrigins.includes(requestOrigin);
  const allowOrigin = isAllowed ? requestOrigin : (allowedOrigins[0] || '*');

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cookie, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handleCorsResponse(data: any, status: number = 200, origin?: string | null) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(origin),
  });
}

export function handleCorsError(message: string, status: number = 500, origin?: string | null) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: corsHeaders(origin),
    }
  );
}

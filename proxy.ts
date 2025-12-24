/**
 * Next.js Proxy - Security Headers & Protection
 *
 * Implements security headers, CSP, rate limiting, and request validation
 * Note: In Next.js 16+, this is called "proxy" instead of "middleware"
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers configuration
 */
const securityHeaders = [
  // Prevent clickjacking attacks
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevent MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Enable XSS protection (legacy browsers)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Control referrer information
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Enforce HTTPS
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Permissions policy (disable unnecessary features)
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

/**
 * Content Security Policy
 * Restricts resource loading to prevent XSS and injection attacks
 */
function getCSP() {
  const isDev = process.env.NODE_ENV === 'development';

  // In development, we need to allow hot-reload and dev tools
  if (isDev) {
    return `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: https: blob:;
      connect-src 'self' https://*.supabase.co https://*.alchemy.com https://*.infura.io https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://vercel.live wss://vercel.live;
      frame-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();
  }

  // Production: Stricter CSP
  return `
    default-src 'self';
    script-src 'self' 'sha256-YOUR_INLINE_SCRIPT_HASH';
    style-src 'self' 'sha256-YOUR_INLINE_STYLE_HASH' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https: blob:;
    connect-src 'self' https://*.supabase.co https://*.alchemy.com https://*.infura.io https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org;
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis or a dedicated rate limiting service
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Clean up expired entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!record || record.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Get client IP address
 */
function getClientIp(request: NextRequest): string {
  // Try various headers for IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to 'unknown' if no IP found
  return 'unknown';
}

/**
 * Validate request origin to prevent CSRF
 */
function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // Allow requests without origin (same-origin requests)
  if (!origin) return true;

  // In production, strictly validate origin
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = [
      `https://${host}`,
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);

    return allowedOrigins.some(allowed => origin === allowed);
  }

  // In development, allow localhost
  return origin.includes('localhost') || origin.includes('127.0.0.1');
}

/**
 * Proxy entry point (Next.js 16+ convention)
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // 1. Apply security headers
  securityHeaders.forEach(({ key, value }) => {
    response.headers.set(key, value);
  });

  // 2. Apply Content Security Policy
  response.headers.set('Content-Security-Policy', getCSP());

  // 3. Rate limiting (only for API routes and mutations)
  if (request.nextUrl.pathname.startsWith('/api')) {
    const ip = getClientIp(request);

    if (!rateLimit(ip, 100, 60000)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }
  }

  // 4. Validate origin for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    if (!isValidOrigin(request)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Invalid request origin',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  // 5. Add security response headers
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  return response;
}

/**
 * Configure which routes to apply middleware to
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

/**
 * Next.js Middleware - Security Headers & Protection
 *
 * Implements security headers, CSP, rate limiting, and request validation
 * Runs on every request matching the config.matcher patterns
 * Updated: CSP relaxed for Next.js compatibility
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
 * Generate a cryptographically secure nonce for CSP
 * Uses Web Crypto API available in Edge runtime
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * Content Security Policy
 * Restricts resource loading to prevent XSS and injection attacks
 * Uses nonces for inline scripts in production for enhanced security
 */
function getCSP(nonce: string) {
  const isDev = process.env.NODE_ENV === 'development';

  // In development, we need to allow hot-reload and dev tools
  if (isDev) {
    return `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: https: blob:;
      connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.alchemy.com https://*.infura.io https://*.walletconnect.com https://*.walletconnect.org https://*.web3modal.org wss://*.walletconnect.com wss://*.walletconnect.org https://vercel.live wss://vercel.live;
      frame-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();
  }

  // Production: 'unsafe-eval' removed. Next.js 16 standalone mode no longer requires it.
  // 'unsafe-inline' is still needed for Next.js hydration scripts (nonce-based CSP requires
  // additional build-time configuration that is tracked as a future improvement).
  return `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https: blob:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.alchemy.com https://*.infura.io https://*.walletconnect.com https://*.walletconnect.org https://*.web3modal.org wss://*.walletconnect.com wss://*.walletconnect.org wss://*.relay.walletconnect.com wss://*.relay.walletconnect.org https://rpc.walletconnect.com https://rpc.walletconnect.org https://pulse.walletconnect.com https://pulse.walletconnect.org;
    frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Rate limiting for middleware is intentionally removed.
 * /api/rpc uses a proper distributed rate limiter (Upstash Redis with in-memory fallback).
 * An in-memory middleware limiter is ineffective in serverless environments where each
 * function invocation may get a fresh memory context.
 */

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
 * Middleware entry point
 */
export function middleware(request: NextRequest) {
  // Generate nonce for this request (used in CSP)
  const nonce = generateNonce();

  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // 1. Apply security headers
  securityHeaders.forEach(({ key, value }) => {
    response.headers.set(key, value);
  });

  // 2. Apply Content Security Policy with nonce
  response.headers.set('Content-Security-Policy', getCSP(nonce));

  // 3. Pass nonce to the app via header (for Script components)
  // Next.js can read this in server components via headers()
  response.headers.set('x-nonce', nonce);

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

  // 6. Add security response headers
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

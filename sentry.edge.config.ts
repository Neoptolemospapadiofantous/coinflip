// Sentry Edge Runtime Configuration
// This file configures the initialization of Sentry for edge features (middleware, edge routes).

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,

    // Lower sample rate for edge functions (they run frequently)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.5,

    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',
  });
}

// Sentry Server-Side Configuration
// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,

    // Adjust sampling rate for production traffic
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',

    // Filter out known non-issues
    beforeSend(event, hint) {
      const error = hint.originalException;
      const message = error instanceof Error ? error.message : String(error);

      // Ignore user-cancelled wallet errors
      if (
        message.includes('User rejected') ||
        message.includes('User denied') ||
        message.includes('user rejected')
      ) {
        return null;
      }

      return event;
    },
  });
}

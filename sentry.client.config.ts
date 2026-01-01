// Sentry Client-Side Configuration
// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,

    // Adjust sampling rate for production traffic
    // Set to 1.0 to capture all transactions for development
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Capture Replay for 10% of all sessions
    // Plus for 100% of sessions with an error
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      // Session replay for debugging
      ...(process.env.NODE_ENV === 'production'
        ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
        : []),
    ],

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

      // Ignore network/fetch errors (handled gracefully in app)
      if (
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('Load failed')
      ) {
        return null;
      }

      return event;
    },

    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',
  });
}

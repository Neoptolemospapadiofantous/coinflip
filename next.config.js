const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployments
  output: 'standalone',
  // instrumentation.ts is now supported by default in Next.js 16
  // Turbopack configuration (Next.js 16 default)
  turbopack: {
    // Empty config to acknowledge Turbopack usage
    // Modern wagmi/viem handle browser compatibility better
  },
  // Webpack configuration (fallback for --webpack flag)
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  // Disable source maps in production for security (Sentry will use its own)
  productionBrowserSourceMaps: false,
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Organization and project for Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Only upload source maps in production builds
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',
  // Hide source maps from browser
  hideSourceMaps: true,
  // Automatically annotate React components for better stack traces
  reactComponentAnnotation: {
    enabled: true,
  },
};

// Only wrap with Sentry if DSN is configured
module.exports = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

module.exports = nextConfig;

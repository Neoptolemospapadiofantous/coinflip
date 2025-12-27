/**
 * Environment Variable Validation
 *
 * Validates and types all environment variables at startup.
 * Fails fast if required variables are missing.
 */

import { z } from 'zod';

// Define environment schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase (public)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key required'),

  // Supabase (server-side only)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Service role key required for production').optional(),

  // Contract addresses
  NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Sepolia contract address').optional(),
  NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Amoy contract address').optional(),
  NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Polygon contract address').optional(),

  // Network configuration
  NEXT_PUBLIC_CHAIN_ID: z.string().regex(/^\d+$/, 'Chain ID must be numeric'),
  SEPOLIA_RPC_URL: z.string().url('Invalid Sepolia RPC URL').optional(),
  AMOY_RPC_URL: z.string().url('Invalid Amoy RPC URL').optional(),
  POLYGON_RPC_URL: z.string().url('Invalid Polygon RPC URL').optional(),

  // Deployment keys (server-side only)
  PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format').optional(),

  // VRF Configuration
  VRF_SUBSCRIPTION_ID: z.string().min(1, 'VRF subscription ID required').optional(),

  // WalletConnect
  NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: z.string().min(1, 'WalletConnect project ID required'),

  // API Keys (server-side only - no NEXT_PUBLIC_ prefix)
  ALCHEMY_API_KEY: z.string().optional(),
  POLYGONSCAN_API_KEY: z.string().optional(),
  ETHERSCAN_API_KEY: z.string().optional(),

  // App configuration
  NEXT_PUBLIC_APP_NAME: z.string().default('CoinFlip'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Feature flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().optional(),
  NEXT_PUBLIC_ENABLE_TESTNET: z.string().optional(),
});

// Indexer-specific environment schema
const indexerEnvSchema = envSchema.extend({
  // Required for indexer
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Service role key required for indexer'),
  NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address required for indexer'),
  SEPOLIA_RPC_URL: z.string().url('RPC URL required for indexer'),
});

// Export validated environment
export type Env = z.infer<typeof envSchema>;
export type IndexerEnv = z.infer<typeof indexerEnvSchema>;

/**
 * Validate environment variables for frontend/backend
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);

    // Production-specific validations
    if (env.NODE_ENV === 'production') {
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production');
      }
      if (!env.ALCHEMY_API_KEY) {
        console.warn('⚠️  ALCHEMY_API_KEY not set - RPC calls may be rate limited');
      }
    }

    return env;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues?.map((err: any) =>
        `  ❌ ${err.path.join('.')}: ${err.message}`
      ).join('\n') || error.message;

      throw new Error(
        `\n❌ Environment variable validation failed:\n\n${errorMessages}\n\n` +
        `Please check your .env.local file and ensure all required variables are set.\n`
      );
    }
    throw error;
  }
}

/**
 * Validate environment variables specifically for indexer
 */
export function validateIndexerEnv(): IndexerEnv {
  try {
    const env = indexerEnvSchema.parse(process.env);

    console.log('✅ Environment variables validated');
    console.log(`📍 Environment: ${env.NODE_ENV}`);
    console.log(`📍 Chain ID: ${env.NEXT_PUBLIC_CHAIN_ID}`);
    console.log(`📍 Contract: ${env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA}`);

    return env;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues?.map((err: any) =>
        `  ❌ ${err.path.join('.')}: ${err.message}`
      ).join('\n') || error.message;

      throw new Error(
        `\n❌ Indexer environment variable validation failed:\n\n${errorMessages}\n\n` +
        `Required variables for indexer:\n` +
        `  - NEXT_PUBLIC_SUPABASE_URL\n` +
        `  - SUPABASE_SERVICE_ROLE_KEY (not anon key!)\n` +
        `  - NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA\n` +
        `  - SEPOLIA_RPC_URL\n` +
        `  - NEXT_PUBLIC_CHAIN_ID\n\n`
      );
    }
    throw error;
  }
}

/**
 * Get typed environment variable
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  const env = validateEnv();
  return env[key];
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get contract address for current chain
 */
export function getContractAddress(): string {
  const env = validateEnv();
  const chainId = env.NEXT_PUBLIC_CHAIN_ID;

  switch (chainId) {
    case '11155111': // Sepolia
      return env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA || '';
    case '80002': // Amoy
      return env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY || '';
    case '137': // Polygon
      return env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON || '';
    default:
      throw new Error(`No contract address configured for chain ID: ${chainId}`);
  }
}

/**
 * Get RPC URL for current chain
 */
export function getRpcUrl(): string {
  const env = validateEnv();
  const chainId = env.NEXT_PUBLIC_CHAIN_ID;

  switch (chainId) {
    case '11155111': // Sepolia
      if (env.SEPOLIA_RPC_URL) return env.SEPOLIA_RPC_URL;
      if (env.ALCHEMY_API_KEY) {
        return `https://eth-sepolia.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
      }
      return 'https://rpc.sepolia.org';
    case '80002': // Amoy
      return env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';
    case '137': // Polygon
      return env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    default:
      throw new Error(`No RPC URL configured for chain ID: ${chainId}`);
  }
}

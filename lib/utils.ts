import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits } from 'viem';

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development';

// Patterns that might contain sensitive data
const SENSITIVE_PATTERNS = [
  /0x[a-fA-F0-9]{64}/g,  // Private keys / 32-byte hashes
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT tokens
  /sk_[a-zA-Z0-9]+/g,    // API secret keys
  /password['":\s]*['"][^'"]+['"]/gi, // Password fields
  /secret['":\s]*['"][^'"]+['"]/gi,   // Secret fields
  /api[_-]?key['":\s]*['"][^'"]+['"]/gi, // API keys
];

// Sanitize a single value for logging
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let sanitized = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }
  if (value instanceof Error) {
    // Sanitize error message but keep stack trace structure
    return {
      name: value.name,
      message: sanitizeValue(value.message),
      stack: isDev ? value.stack : '[Stack hidden in production]',
    };
  }
  if (typeof value === 'object' && value !== null) {
    // In production, only show shallow object structure
    if (!isDev) {
      return '[Object]';
    }
  }
  return value;
}

// Development-only logger - prevents sensitive data from leaking to production console
export const devLog = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => {
    // Always log errors but sanitize sensitive data in production
    if (isDev) {
      console.error(...args);
    } else {
      console.error(...args.map(sanitizeValue));
    }
  },
  info: (...args: unknown[]) => isDev && console.info(...args),
};

// Tailwind utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format address for display (0x1234...5678)
export function formatAddress(address: string): string {
  if (!address) return '';
  // Ethereum addresses are 42 characters (0x + 40 hex chars)
  if (address.length < 10) return address; // Too short to format
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format ETH/MATIC from wei to readable amount
export function formatCurrency(wei: bigint | string, decimals = 18): string {
  const value = typeof wei === 'string' ? BigInt(wei) : wei;
  const formatted = formatUnits(value, decimals);
  const num = parseFloat(formatted);

  // Handle very small amounts (show up to 8 decimals if needed)
  if (num > 0 && num < 0.0001) {
    // For tiny amounts, show up to 8 decimals
    return num.toFixed(8).replace(/\.?0+$/, '') + ' ETH';
  }

  // For normal amounts, show up to 4 decimal places
  return num.toFixed(4).replace(/\.?0+$/, '') + ' ETH';
}

// Format currency as USD (for display purposes)
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format number with compact notation (1.2K, 1.2M, etc)
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

// Format date/time
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// Format relative time (2 minutes ago)
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Format transaction hash for display
export function formatTxHash(hash: string): string {
  if (!hash) return '';
  // Transaction hashes are 66 characters (0x + 64 hex chars)
  if (hash.length < 20) return hash; // Too short to format
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

// Get block explorer URL - re-export from centralized config
export { getBlockExplorerUrl } from './chainConfig';

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Safe localStorage helpers - handles SSR, incognito mode, and quota errors
export const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      devLog.warn(`Failed to read localStorage key: ${key}`);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      devLog.warn(`Failed to write localStorage key: ${key}`);
      return false;
    }
  },
  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      devLog.warn(`Failed to remove localStorage key: ${key}`);
      return false;
    }
  },
};

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Validate Ethereum address
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Get coin side label
export function getCoinSideLabel(side: boolean): string {
  return side ? 'Tails' : 'Heads';
}

// Get coin side emoji
export function getCoinSideEmoji(side: boolean): string {
  return side ? '🪙' : '👑';
}

/**
 * Chainlink Automation auto-cancel timeout
 * Contract uses TIMEOUT_BLOCKS = 25 (~5 minutes on Sepolia @ 12s/block)
 */
const AUTO_CANCEL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a pending game is eligible for Chainlink auto-cancel
 * (past the 5 minute threshold)
 */
export function isGameAutoCancelEligible(createdAt: string): boolean {
  const now = new Date().getTime();
  const created = new Date(createdAt).getTime();
  return (now - created) > AUTO_CANCEL_TIMEOUT_MS;
}

/**
 * Format game ID for display (1-indexed for user-friendliness)
 * Contract uses 0-indexed game IDs, but users expect numbering to start at 1
 */
export function formatGameId(gameId: string | number): string {
  const id = typeof gameId === 'string' ? parseInt(gameId, 10) : gameId;
  if (isNaN(id)) return '#?';
  return `#${id + 1}`;
}

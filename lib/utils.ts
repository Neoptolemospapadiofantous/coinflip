import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits } from 'viem';

// Tailwind utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format address for display (0x1234...5678)
export function formatAddress(address: string): string {
  if (!address) return '';
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
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

// Get block explorer URL
export function getBlockExplorerUrl(chainId: number, hash: string, type: 'tx' | 'address'): string {
  const explorers: Record<number, string> = {
    137: 'https://polygonscan.com', // Polygon Mainnet
    80001: 'https://mumbai.polygonscan.com', // Mumbai Testnet
  };

  const baseUrl = explorers[chainId] || explorers[80001];
  return `${baseUrl}/${type}/${hash}`;
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Check if a pending game has timed out
 * Games timeout after 20 minutes of no activity
 */
export function isGameTimedOut(createdAt: string): boolean {
  const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
  const now = new Date().getTime();
  const created = new Date(createdAt).getTime();
  return (now - created) > TIMEOUT_MS;
}

/**
 * Get remaining time until game timeout
 */
export function getTimeoutRemaining(createdAt: string): string {
  const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
  const now = new Date().getTime();
  const created = new Date(createdAt).getTime();
  const elapsed = now - created;
  const remaining = Math.max(0, TIMEOUT_MS - elapsed);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (remaining === 0) return 'Expired';
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
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

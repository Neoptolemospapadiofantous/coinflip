/**
 * Security Utilities
 *
 * Input validation, sanitization, and security helpers
 */

import { isAddress } from 'viem';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/**
 * Validate and sanitize Ethereum address
 */
export function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return isAddress(address);
}

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';

  // Trim whitespace
  let sanitized = input.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>"']/g, '');

  return sanitized;
}

/**
 * Validate transaction hash
 */
export function validateTxHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate game ID (must be non-negative integer)
 */
export function validateGameId(gameId: unknown): boolean {
  if (typeof gameId === 'number') {
    return Number.isInteger(gameId) && gameId >= 0;
  }
  if (typeof gameId === 'string') {
    const num = parseInt(gameId, 10);
    return !isNaN(num) && num >= 0 && num.toString() === gameId;
  }
  if (typeof gameId === 'bigint') {
    return gameId >= 0n;
  }
  return false;
}

/**
 * Validate tier ID (0-9)
 */
export function validateTierId(tier: unknown): boolean {
  if (typeof tier === 'number') {
    return Number.isInteger(tier) && tier >= 0 && tier < 10;
  }
  if (typeof tier === 'string') {
    const num = parseInt(tier, 10);
    return !isNaN(num) && num >= 0 && num < 10;
  }
  return false;
}

/**
 * Validate amount (must be positive number)
 */
export function validateAmount(amount: unknown): boolean {
  if (typeof amount === 'number') {
    return isFinite(amount) && amount > 0;
  }
  if (typeof amount === 'string') {
    const num = parseFloat(amount);
    return !isNaN(num) && isFinite(num) && num > 0;
  }
  if (typeof amount === 'bigint') {
    return amount > 0n;
  }
  return false;
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number = 10,
    private windowMs: number = 60000
  ) {}

  /**
   * Check if action is allowed for this key
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove expired attempts
    const validAttempts = attempts.filter(time => now - time < this.windowMs);

    // Check if under limit
    if (validAttempts.length >= this.maxAttempts) {
      this.attempts.set(key, validAttempts);
      return false;
    }

    // Add new attempt
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);

    return true;
  }

  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clear old entries periodically
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(time => now - time < this.windowMs);
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }
}

/**
 * Distributed Rate Limiter using Upstash Redis
 * Falls back to in-memory rate limiting if Redis is not configured
 */
export class DistributedRateLimiter {
  private ratelimit: Ratelimit | null = null;
  private fallback: RateLimiter;
  private useRedis: boolean = false;

  constructor(
    private maxRequests: number = 100,
    private windowSeconds: number = 60,
    private prefix: string = 'ratelimit'
  ) {
    // Initialize fallback in-memory limiter
    this.fallback = new RateLimiter(maxRequests, windowSeconds * 1000);

    // Try to initialize Redis rate limiter
    this.initRedis();
  }

  private initRedis(): void {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      try {
        const redis = new Redis({
          url: redisUrl,
          token: redisToken,
        });

        this.ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(this.maxRequests, `${this.windowSeconds} s`),
          prefix: this.prefix,
          analytics: true,
        });

        this.useRedis = true;
        console.log('[RateLimiter] Using distributed Redis rate limiting');
      } catch (error) {
        console.warn('[RateLimiter] Failed to initialize Redis, using in-memory fallback:', error);
        this.useRedis = false;
      }
    } else {
      console.log('[RateLimiter] No Redis config found, using in-memory rate limiting');
    }
  }

  /**
   * Check if action is allowed for this key
   */
  async isAllowed(key: string): Promise<boolean> {
    if (this.useRedis && this.ratelimit) {
      try {
        const { success } = await this.ratelimit.limit(key);
        return success;
      } catch (error) {
        // On Redis error, fall back to in-memory
        console.warn('[RateLimiter] Redis error, falling back to in-memory:', error);
        return this.fallback.isAllowed(key);
      }
    }

    return this.fallback.isAllowed(key);
  }

  /**
   * Synchronous check (always uses fallback for sync contexts)
   */
  isAllowedSync(key: string): boolean {
    return this.fallback.isAllowed(key);
  }

  /**
   * Get remaining requests for a key (only works with Redis)
   */
  async getRemaining(key: string): Promise<{ remaining: number; reset: number } | null> {
    if (this.useRedis && this.ratelimit) {
      try {
        const { remaining, reset } = await this.ratelimit.limit(key);
        return { remaining, reset };
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Check if using Redis
   */
  isDistributed(): boolean {
    return this.useRedis;
  }

  /**
   * Clear old entries (only for in-memory fallback)
   */
  cleanup(): void {
    this.fallback.cleanup();
  }
}

/**
 * Create a singleton distributed rate limiter for API routes
 */
let apiRateLimiter: DistributedRateLimiter | null = null;

export function getApiRateLimiter(): DistributedRateLimiter {
  if (!apiRateLimiter) {
    apiRateLimiter = new DistributedRateLimiter(100, 60, 'api:rpc');
  }
  return apiRateLimiter;
}

/**
 * Secure random string generator
 */
export function generateSecureToken(length: number = 32): string {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for Node.js - use globalThis.crypto which is available in modern Node.js
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    const array = new Uint8Array(length);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('No secure random generator available');
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string, allowedDomains?: string[]): string | null {
  try {
    const parsed = new URL(url);

    // Only allow http(s) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Check against allowed domains if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Prevent timing attacks in string comparison
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page: unknown,
  limit: unknown,
  maxLimit: number = 100
): { page: number; limit: number } | null {
  const parsedPage = typeof page === 'string' ? parseInt(page, 10) : page;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;

  if (
    typeof parsedPage !== 'number' ||
    typeof parsedLimit !== 'number' ||
    !Number.isInteger(parsedPage) ||
    !Number.isInteger(parsedLimit) ||
    parsedPage < 1 ||
    parsedLimit < 1 ||
    parsedLimit > maxLimit
  ) {
    return null;
  }

  return { page: parsedPage, limit: parsedLimit };
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJson<T = unknown>(
  input: unknown,
  maxDepth: number = 10
): T | null {
  try {
    // If already object, stringify and re-parse to sanitize
    const jsonString = typeof input === 'string' ? input : JSON.stringify(input);

    // Check max length (prevent DoS)
    if (jsonString.length > 100000) return null;

    const parsed = JSON.parse(jsonString);

    // Check depth
    function checkDepth(obj: unknown, depth: number = 0): boolean {
      if (depth > maxDepth) return false;
      if (obj === null || typeof obj !== 'object') return true;

      for (const key in obj as Record<string, unknown>) {
        if (!checkDepth((obj as Record<string, unknown>)[key], depth + 1)) return false;
      }
      return true;
    }

    if (!checkDepth(parsed)) return null;

    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Check if request is from allowed origin
 */
export function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

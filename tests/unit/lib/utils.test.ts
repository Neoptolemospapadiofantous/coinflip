/**
 * Tests for lib/utils.ts
 * Core utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  cn,
  formatAddress,
  formatCurrency,
  formatNumber,
  formatGameId,
  getCoinSideEmoji,
  getCoinSideLabel,
  sleep,
  isValidAddress,
  formatTxHash,
  formatRelativeTime,
  isGameTimedOut,
} from '@/lib/utils';

describe('lib/utils', () => {
  describe('cn (classNames)', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const shouldIncludeBar = false;
      expect(cn('foo', shouldIncludeBar && 'bar', 'baz')).toBe('foo baz');
    });

    it('should merge tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });

    it('should handle undefined and null', () => {
      expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
    });
  });

  describe('formatAddress', () => {
    it('should format a valid address', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(formatAddress(address)).toBe('0x1234...7890');
    });

    it('should handle empty string', () => {
      expect(formatAddress('')).toBe('');
    });
  });

  describe('formatCurrency', () => {
    it('should format wei to ETH', () => {
      const wei = BigInt('1000000000000000000'); // 1 ETH
      const result = formatCurrency(wei);
      expect(result).toContain('1');
      expect(result).toContain('ETH');
    });

    it('should handle string wei values', () => {
      const result = formatCurrency('1000000000000000000');
      expect(result).toContain('1');
      expect(result).toContain('ETH');
    });

    it('should handle small amounts', () => {
      const wei = BigInt('10000000000000'); // 0.00001 ETH
      const result = formatCurrency(wei);
      expect(result).toContain('ETH');
    });
  });

  describe('formatNumber', () => {
    it('should format thousands with compact notation', () => {
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('should format millions with compact notation', () => {
      expect(formatNumber(1500000)).toBe('1.5M');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(100)).toBe('100');
    });
  });

  describe('formatGameId', () => {
    it('should format game ID with # and 1-indexed', () => {
      expect(formatGameId(0)).toBe('#1');
      expect(formatGameId(9)).toBe('#10');
    });

    it('should handle string game IDs', () => {
      expect(formatGameId('5')).toBe('#6');
    });

    it('should handle invalid input', () => {
      expect(formatGameId('invalid')).toBe('#?');
    });
  });

  describe('getCoinSideEmoji', () => {
    it('should return crown for heads (false)', () => {
      expect(getCoinSideEmoji(false)).toBe('👑');
    });

    it('should return coin for tails (true)', () => {
      expect(getCoinSideEmoji(true)).toBe('🪙');
    });
  });

  describe('getCoinSideLabel', () => {
    it('should return Heads for false', () => {
      expect(getCoinSideLabel(false)).toBe('Heads');
    });

    it('should return Tails for true', () => {
      expect(getCoinSideLabel(true)).toBe('Tails');
    });
  });

  describe('sleep', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });
  });

  describe('isValidAddress', () => {
    it('should validate correct address', () => {
      expect(isValidAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidAddress('0x123')).toBe(false);
      expect(isValidAddress('not-an-address')).toBe(false);
    });
  });

  describe('formatTxHash', () => {
    it('should format transaction hash', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(formatTxHash(hash)).toBe('0x12345678...90abcdef');
    });

    it('should return empty string for empty input', () => {
      expect(formatTxHash('')).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format seconds ago', () => {
      const date = new Date(Date.now() - 30000);
      expect(formatRelativeTime(date)).toMatch(/\d+s ago/);
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 120000);
      expect(formatRelativeTime(date)).toMatch(/\d+m ago/);
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 3600000);
      expect(formatRelativeTime(date)).toMatch(/\d+h ago/);
    });
  });

  describe('isGameTimedOut', () => {
    it('should return false for recent game', () => {
      const recentDate = new Date().toISOString();
      expect(isGameTimedOut(recentDate)).toBe(false);
    });

    it('should return true for old game (>20 min)', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 1000).toISOString();
      expect(isGameTimedOut(oldDate)).toBe(true);
    });
  });
});

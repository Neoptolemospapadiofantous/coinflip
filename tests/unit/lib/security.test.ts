/**
 * Tests for lib/security.ts
 * Security utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  validateTxHash,
  validateAddress,
  validateGameId,
  validateTierId,
  validateAmount,
  generateSecureToken,
  sanitizeUrl,
  constantTimeCompare,
  validatePagination,
  escapeHtml,
  sanitizeJson,
  isAllowedOrigin,
  RateLimiter,
} from '@/lib/security';

describe('lib/security', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
    });

    it('should respect max length', () => {
      expect(sanitizeString('hello world', 5)).toBe('hello');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeString('hello<>"\'')).toBe('hello');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(123 as unknown as string)).toBe('');
    });
  });

  describe('validateTxHash', () => {
    it('should validate correct tx hash', () => {
      const validHash = '0x' + 'a'.repeat(64);
      expect(validateTxHash(validHash)).toBe(true);
    });

    it('should reject invalid tx hash - wrong length', () => {
      expect(validateTxHash('0x1234')).toBe(false);
    });

    it('should reject invalid tx hash - no prefix', () => {
      expect(validateTxHash('a'.repeat(64))).toBe(false);
    });

    it('should reject invalid tx hash - invalid chars', () => {
      expect(validateTxHash('0x' + 'g'.repeat(64))).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(validateTxHash(null as unknown as string)).toBe(false);
      expect(validateTxHash(undefined as unknown as string)).toBe(false);
    });
  });

  describe('validateAddress', () => {
    it('should validate correct address', () => {
      const validAddress = '0x' + 'a'.repeat(40);
      expect(validateAddress(validAddress)).toBe(true);
    });

    it('should validate checksummed address', () => {
      expect(validateAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true);
    });

    it('should reject invalid address - wrong length', () => {
      expect(validateAddress('0x1234')).toBe(false);
    });

    it('should reject invalid address - no prefix', () => {
      expect(validateAddress('a'.repeat(40))).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(validateAddress(null as unknown as string)).toBe(false);
      expect(validateAddress(undefined as unknown as string)).toBe(false);
    });
  });

  describe('validateGameId', () => {
    it('should validate zero and positive integers', () => {
      expect(validateGameId(0)).toBe(true);
      expect(validateGameId(1)).toBe(true);
      expect(validateGameId(12345)).toBe(true);
    });

    it('should validate string numbers', () => {
      expect(validateGameId('0')).toBe(true);
      expect(validateGameId('123')).toBe(true);
    });

    it('should validate bigint', () => {
      expect(validateGameId(0n)).toBe(true);
      expect(validateGameId(100n)).toBe(true);
    });

    it('should reject negative numbers', () => {
      expect(validateGameId(-1)).toBe(false);
      expect(validateGameId(-1n)).toBe(false);
    });

    it('should reject non-integer numbers', () => {
      expect(validateGameId(1.5)).toBe(false);
    });

    it('should reject non-numeric strings', () => {
      expect(validateGameId('abc')).toBe(false);
    });
  });

  describe('validateTierId', () => {
    it('should accept valid tier IDs (0-9)', () => {
      expect(validateTierId(0)).toBe(true);
      expect(validateTierId(5)).toBe(true);
      expect(validateTierId(9)).toBe(true);
    });

    it('should reject tier IDs out of range', () => {
      expect(validateTierId(-1)).toBe(false);
      expect(validateTierId(10)).toBe(false);
    });

    it('should accept string tier IDs', () => {
      expect(validateTierId('0')).toBe(true);
      expect(validateTierId('5')).toBe(true);
    });
  });

  describe('validateAmount', () => {
    it('should accept positive numbers', () => {
      expect(validateAmount(1)).toBe(true);
      expect(validateAmount(0.001)).toBe(true);
    });

    it('should reject zero and negative', () => {
      expect(validateAmount(0)).toBe(false);
      expect(validateAmount(-1)).toBe(false);
    });

    it('should accept positive bigint', () => {
      expect(validateAmount(1n)).toBe(true);
    });

    it('should reject zero bigint', () => {
      expect(validateAmount(0n)).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate hex string of correct length', () => {
      const result = generateSecureToken(16);
      expect(result).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate different values each time', () => {
      const a = generateSecureToken(16);
      const b = generateSecureToken(16);
      expect(a).not.toBe(b);
    });

    it('should only contain hex characters', () => {
      const result = generateSecureToken(32);
      expect(result).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    });

    it('should allow valid http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    });

    it('should reject javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
    });

    it('should reject data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe(null);
    });

    it('should validate against allowed domains', () => {
      expect(sanitizeUrl('https://allowed.com', ['allowed.com'])).toBeTruthy();
      expect(sanitizeUrl('https://notallowed.com', ['allowed.com'])).toBe(null);
    });

    it('should allow subdomains of allowed domains', () => {
      expect(sanitizeUrl('https://sub.allowed.com', ['allowed.com'])).toBeTruthy();
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      expect(constantTimeCompare('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeCompare('hello', 'world')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(constantTimeCompare('hi', 'hello')).toBe(false);
    });
  });

  describe('validatePagination', () => {
    it('should accept valid pagination', () => {
      expect(validatePagination(1, 10)).toEqual({ page: 1, limit: 10 });
    });

    it('should accept string values', () => {
      expect(validatePagination('1', '10')).toEqual({ page: 1, limit: 10 });
    });

    it('should reject page less than 1', () => {
      expect(validatePagination(0, 10)).toBe(null);
    });

    it('should reject limit greater than max', () => {
      expect(validatePagination(1, 200, 100)).toBe(null);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
      expect(escapeHtml("'single'")).toBe('&#039;single&#039;');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });
  });

  describe('sanitizeJson', () => {
    it('should parse valid JSON', () => {
      expect(sanitizeJson('{"foo": "bar"}')).toEqual({ foo: 'bar' });
    });

    it('should handle object input', () => {
      expect(sanitizeJson({ foo: 'bar' })).toEqual({ foo: 'bar' });
    });

    it('should reject deeply nested objects', () => {
      let deep: unknown = { value: 'end' };
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
      }
      expect(sanitizeJson(deep, 10)).toBe(null);
    });

    it('should reject very long JSON', () => {
      const longString = JSON.stringify({ data: 'x'.repeat(150000) });
      expect(sanitizeJson(longString)).toBe(null);
    });
  });

  describe('isAllowedOrigin', () => {
    it('should return true for allowed origin', () => {
      expect(isAllowedOrigin('https://example.com', ['https://example.com'])).toBe(true);
    });

    it('should return false for disallowed origin', () => {
      expect(isAllowedOrigin('https://evil.com', ['https://example.com'])).toBe(false);
    });

    it('should return false for null origin', () => {
      expect(isAllowedOrigin(null, ['https://example.com'])).toBe(false);
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests under limit', () => {
      const limiter = new RateLimiter(3, 1000);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(true);
    });

    it('should block requests over limit', () => {
      const limiter = new RateLimiter(2, 1000);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(false);
    });

    it('should reset after calling reset', () => {
      const limiter = new RateLimiter(1, 1000);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(false);
      limiter.reset('test');
      expect(limiter.isAllowed('test')).toBe(true);
    });

    it('should track different keys separately', () => {
      const limiter = new RateLimiter(1, 1000);
      expect(limiter.isAllowed('a')).toBe(true);
      expect(limiter.isAllowed('b')).toBe(true);
      expect(limiter.isAllowed('a')).toBe(false);
      expect(limiter.isAllowed('b')).toBe(false);
    });
  });
});

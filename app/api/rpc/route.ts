import { NextRequest, NextResponse } from 'next/server';
import { getApiRateLimiter, sanitizeJson } from '@/lib/security';
import { ALLOWED_CHAIN_IDS, CHAIN_IDS, PUBLIC_RPC_URLS } from '@/lib/chainConfig';
import { devLog } from '@/lib/utils';

// =============================================================
// RATE LIMITING (using distributed RateLimiter with Redis/fallback)
// =============================================================

// Get singleton distributed rate limiter (100 requests per minute per IP)
const rateLimiter = getApiRateLimiter();

// Cleanup old entries periodically for in-memory fallback (every 5 minutes)
setInterval(() => rateLimiter.cleanup(), 300000);

// Get client identifier (IP address)
function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

// =============================================================
// SECURITY HEADERS
// =============================================================

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

// =============================================================
// RPC CONFIGURATION (using centralized chainConfig)
// =============================================================

// Build RPC URLs with private API keys where available
const RPC_URLS: Record<number, string> = {
  // Sepolia - use Alchemy if available, fallback to public
  [CHAIN_IDS.SEPOLIA]: process.env.ALCHEMY_API_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : PUBLIC_RPC_URLS[CHAIN_IDS.SEPOLIA],
  // Polygon Amoy
  [CHAIN_IDS.POLYGON_AMOY]: PUBLIC_RPC_URLS[CHAIN_IDS.POLYGON_AMOY],
  // Polygon Mainnet
  [CHAIN_IDS.POLYGON]: PUBLIC_RPC_URLS[CHAIN_IDS.POLYGON],
};

// Whitelist of allowed RPC methods (read-only and transaction submission)
const ALLOWED_METHODS = new Set([
  // Read methods
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getTransactionCount',
  'eth_getLogs',
  'eth_getFilterLogs',
  'eth_newFilter',
  'eth_newBlockFilter',
  'eth_getFilterChanges',
  'eth_uninstallFilter',
  'net_version',
  // Transaction submission
  'eth_sendRawTransaction',
]);

// RPC request timeout in milliseconds
const RPC_TIMEOUT = 15000;

// =============================================================
// RESPONSE CACHING (for read-only methods)
// =============================================================

// Cache TTLs in milliseconds per method
const CACHE_TTLS: Record<string, number> = {
  'eth_chainId': 3600000,       // 1 hour (chain ID never changes)
  'eth_blockNumber': 2000,      // 2 seconds (new block every ~12s on Sepolia)
  'eth_gasPrice': 5000,         // 5 seconds (gas price changes slowly)
  'eth_maxPriorityFeePerGas': 5000,
  'net_version': 3600000,       // 1 hour (network version doesn't change)
};

// Methods that should NOT be cached (state-dependent or transaction-related)
const UNCACHEABLE_METHODS = new Set([
  'eth_sendRawTransaction',
  'eth_getTransactionCount', // Nonce needs to be fresh
  'eth_getBalance',          // Balance can change any time
  'eth_call',                // Contract calls can return different results
  'eth_estimateGas',         // Gas estimates change based on state
  'eth_getLogs',             // Logs depend on block range
  'eth_getFilterLogs',
  'eth_getFilterChanges',
  'eth_newFilter',
  'eth_newBlockFilter',
  'eth_uninstallFilter',
]);

interface CacheEntry {
  response: unknown;
  expiresAt: number;
}

// Simple in-memory cache with automatic cleanup
const responseCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 1000;

function getCacheKey(chainId: number, method: string, params?: unknown[]): string {
  return `${chainId}:${method}:${params ? JSON.stringify(params) : ''}`;
}

function getCachedResponse(key: string): unknown | null {
  const entry = responseCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return entry.response;
}

function setCachedResponse(key: string, response: unknown, ttlMs: number): void {
  // Evict oldest entries if cache is too large
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }

  responseCache.set(key, {
    response,
    expiresAt: Date.now() + ttlMs,
  });
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now > entry.expiresAt) {
      responseCache.delete(key);
    }
  }
}, 60000); // Every minute

// Validate JSON-RPC request structure
function isValidJsonRpcRequest(body: unknown): body is { jsonrpc: string; method: string; id: number | string; params?: unknown[] } {
  if (typeof body !== 'object' || body === null) return false;
  const req = body as Record<string, unknown>;
  return (
    req.jsonrpc === '2.0' &&
    typeof req.method === 'string' &&
    (typeof req.id === 'number' || typeof req.id === 'string') &&
    (req.params === undefined || Array.isArray(req.params))
  );
}

// Validate JSON-RPC response structure
function isValidJsonRpcResponse(data: unknown): data is { jsonrpc: string; id: unknown; result?: unknown; error?: unknown } {
  if (typeof data !== 'object' || data === null) return false;
  const res = data as Record<string, unknown>;
  return res.jsonrpc === '2.0' && ('result' in res || 'error' in res);
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check using distributed RateLimiter (Redis with in-memory fallback)
    const clientId = getClientId(request);
    const isAllowed = await rateLimiter.isAllowed(clientId);
    if (!isAllowed) {
      return addSecurityHeaders(NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32005, message: 'Rate limit exceeded. Please try again later.' }, id: null },
        { status: 429 }
      ));
    }

    // Check content length to prevent DoS
    const contentLength = request.headers.get('content-length');
    const MAX_PAYLOAD_SIZE = 10240; // 10KB
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return addSecurityHeaders(NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32600, message: 'Request too large' }, id: null },
        { status: 413 }
      ));
    }

    // Parse and sanitize JSON request body
    const rawBody = await request.json();
    const body = sanitizeJson(rawBody, 5); // Max depth of 5 for RPC requests

    if (!body) {
      return addSecurityHeaders(NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid JSON' }, id: null },
        { status: 400 }
      ));
    }

    // Validate JSON-RPC request structure
    if (!isValidJsonRpcRequest(body)) {
      return addSecurityHeaders(NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null },
        { status: 400 }
      ));
    }

    // Validate method is allowed (prevent admin_, debug_, personal_ methods etc.)
    if (!ALLOWED_METHODS.has(body.method)) {
      return addSecurityHeaders(NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32601, message: 'Method not allowed' }, id: body.id },
        { status: 403 }
      ));
    }

    const chainIdHeader = request.headers.get('x-chain-id');
    let chainId: number = CHAIN_IDS.SEPOLIA; // Default to Sepolia (from centralized config)
    if (chainIdHeader) {
      const parsed = parseInt(chainIdHeader, 10);
      if (!isNaN(parsed) && parsed > 0) {
        chainId = parsed;
      }
    }

    // Validate chain ID against whitelist
    if (!ALLOWED_CHAIN_IDS.has(chainId)) {
      return addSecurityHeaders(NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32602, message: 'Unsupported chain ID' }, id: body.id },
        { status: 400 }
      ));
    }

    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      return addSecurityHeaders(NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32602, message: 'RPC not configured for this chain' }, id: body.id },
        { status: 400 }
      ));
    }

    // Check cache for cacheable methods
    const cacheTtl = CACHE_TTLS[body.method];
    const isCacheable = cacheTtl && !UNCACHEABLE_METHODS.has(body.method);

    if (isCacheable) {
      const cacheKey = getCacheKey(chainId, body.method, body.params);
      const cachedData = getCachedResponse(cacheKey);
      if (cachedData) {
        // Return cached response with original request ID
        const cachedResponse = { ...cachedData as Record<string, unknown>, id: body.id };
        const response = addSecurityHeaders(NextResponse.json(cachedResponse));
        response.headers.set('X-Cache', 'HIT');
        return response;
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT);

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't expose internal status codes
        return addSecurityHeaders(NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32603, message: 'RPC server error' }, id: body.id },
          { status: 502 }
        ));
      }

      const data = await response.json();

      // Validate response structure
      if (!isValidJsonRpcResponse(data)) {
        return addSecurityHeaders(NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32603, message: 'Invalid response from RPC server' }, id: body.id },
          { status: 502 }
        ));
      }

      // Cache successful responses for cacheable methods
      if (isCacheable && cacheTtl && !('error' in data)) {
        const cacheKey = getCacheKey(chainId, body.method, body.params);
        setCachedResponse(cacheKey, data, cacheTtl);
      }

      const jsonResponse = addSecurityHeaders(NextResponse.json(data));
      jsonResponse.headers.set('X-Cache', 'MISS');
      return jsonResponse;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return addSecurityHeaders(NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32603, message: 'Request timeout' }, id: body.id },
          { status: 504 }
        ));
      }
      throw fetchError;
    }
  } catch (error) {
    // Log internally but don't expose details
    devLog.error('RPC proxy error:', error);
    return addSecurityHeaders(NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null },
      { status: 500 }
    ));
  }
}

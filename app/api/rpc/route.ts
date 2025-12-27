import { NextRequest, NextResponse } from 'next/server';

// RPC endpoints by chain ID (server-side, no CORS issues)
// Note: ALCHEMY_API_KEY is server-only (no NEXT_PUBLIC_ prefix) to prevent client exposure
const RPC_URLS: Record<number, string> = {
  // Sepolia - use Alchemy if available, fallback to public
  11155111: process.env.ALCHEMY_API_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : 'https://ethereum-sepolia-rpc.publicnode.com',
  // Polygon Amoy
  80002: 'https://rpc-amoy.polygon.technology',
  // Polygon Mainnet
  137: 'https://polygon-rpc.com',
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
    const body = await request.json();

    // Validate JSON-RPC request structure
    if (!isValidJsonRpcRequest(body)) {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null },
        { status: 400 }
      );
    }

    // Validate method is allowed (prevent admin_, debug_, personal_ methods etc.)
    if (!ALLOWED_METHODS.has(body.method)) {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32601, message: 'Method not allowed' }, id: body.id },
        { status: 403 }
      );
    }

    const chainIdHeader = request.headers.get('x-chain-id');
    const chainId = chainIdHeader ? parseInt(chainIdHeader, 10) : 11155111;

    // Validate chain ID is a valid number
    if (isNaN(chainId) || chainId <= 0) {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid chain ID' }, id: body.id },
        { status: 400 }
      );
    }

    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32602, message: `Unsupported chain ID: ${chainId}` }, id: body.id },
        { status: 400 }
      );
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
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32603, message: `RPC server error: ${response.status}` }, id: body.id },
          { status: 502 }
        );
      }

      const data = await response.json();

      // Validate response structure
      if (!isValidJsonRpcResponse(data)) {
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32603, message: 'Invalid response from RPC server' }, id: body.id },
          { status: 502 }
        );
      }

      return NextResponse.json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32603, message: 'RPC request timeout' }, id: body.id },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('RPC proxy error:', error);
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null },
      { status: 500 }
    );
  }
}

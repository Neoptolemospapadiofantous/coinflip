import { NextRequest, NextResponse } from 'next/server';

// RPC endpoints by chain ID (server-side, no CORS issues)
const RPC_URLS: Record<number, string> = {
  // Sepolia - use Alchemy if available, fallback to public
  11155111: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    : 'https://ethereum-sepolia-rpc.publicnode.com',
  // Polygon Amoy
  80002: 'https://rpc-amoy.polygon.technology',
  // Polygon Mainnet
  137: 'https://polygon-rpc.com',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chainId = parseInt(request.headers.get('x-chain-id') || '11155111');

    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('RPC proxy error:', error);
    return NextResponse.json(
      { error: 'RPC request failed' },
      { status: 500 }
    );
  }
}

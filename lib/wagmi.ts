import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http, cookieStorage, createStorage, Config } from 'wagmi';
import { polygon, polygonAmoy, sepolia } from 'wagmi/chains';

// Create a custom transport that uses our API proxy to avoid CORS issues
// The proxy route forwards requests to the actual RPC (Alchemy or public)
const createProxyTransport = (chainId: number) => {
  return http('/api/rpc', {
    fetchOptions: {
      headers: {
        'x-chain-id': chainId.toString(),
      },
    },
  });
};

// Lazy-initialized config to prevent build-time errors when env vars are missing
let _config: Config | null = null;

function getConfig(): Config {
  if (_config) return _config;

  const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
  if (!projectId) {
    throw new Error('Missing NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID environment variable');
  }

  _config = getDefaultConfig({
    appName: 'CoinFlip',
    projectId,
    chains: [
      sepolia,
      polygonAmoy,
      ...(process.env.NODE_ENV === 'production' ? [polygon] : []),
    ],
    transports: {
      [sepolia.id]: createProxyTransport(sepolia.id),
      [polygonAmoy.id]: createProxyTransport(polygonAmoy.id),
      [polygon.id]: createProxyTransport(polygon.id),
    },
    ssr: true,
    // Persist wallet connection state across page refreshes
    storage: createStorage({
      storage: cookieStorage,
    }),
  });

  return _config;
}

// Lazy getter using Proxy to prevent build-time initialization errors
export const config = new Proxy({} as Config, {
  get(_, prop) {
    return getConfig()[prop as keyof Config];
  },
});

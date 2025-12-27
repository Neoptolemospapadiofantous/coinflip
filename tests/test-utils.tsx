/**
 * Test Utilities
 * Custom render function and testing helpers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { Game } from '@/types/game';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// All providers wrapper
interface AllProvidersProps {
  children: React.ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Custom render function
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test fixtures
export const mockAddress = '0x1234567890123456789012345678901234567890' as const;
export const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const;

export const mockGame: Game = {
  id: '1',
  tx_hash: mockTxHash,
  tier: 1,
  amount: '10000000000000000', // 0.01 ETH in wei
  creator_address: mockAddress,
  creator_choice: false,
  joiner_address: null,
  joiner_choice: null,
  status: 'pending',
  winner_address: null,
  coin_result: null,
  payout: null,
  fee: null,
  block_number: '12345678',
  matched_tx_hash: null,
  matched_block_number: null,
  resolved_tx_hash: null,
  resolved_block_number: null,
  cancelled_tx_hash: null,
  cancelled_block_number: null,
  created_at: new Date().toISOString(),
  matched_at: null,
  resolved_at: null,
  cancelled_at: null,
  updated_at: new Date().toISOString(),
};

export const mockTier = {
  id: 1,
  tier_id: 1,
  name: 'Bronze',
  wager: '0.01',
  fee_percentage: 5,
  min_games: 0,
  is_active: true,
  created_at: new Date().toISOString(),
};

// Wait utilities
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock functions
export const createMockFn = <T extends (...args: unknown[]) => unknown>() => {
  return vi.fn() as unknown as T;
};

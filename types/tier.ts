export interface Tier {
  id: number;
  amount: string; // in wei as string
  amountUsd: number; // e.g., 5, 10, 25, 50, 100
  winAmount: string; // in wei as string
  winAmountUsd: number; // e.g., 9.5 (after 5% fee)
  playersInQueue: number;
  enabled: boolean;
}

export const TIER_IDS = {
  FIVE: 0,
  TEN: 1,
  TWENTY_FIVE: 2,
  FIFTY: 3,
  HUNDRED: 4,
} as const;

export type TierId = (typeof TIER_IDS)[keyof typeof TIER_IDS];

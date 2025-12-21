import { Tier } from '@/types/tier';
import { parseEther } from 'viem';

// Mock tier data for development (before Supabase is set up)
export const MOCK_TIERS: Tier[] = [
  {
    id: 0,
    amount: parseEther('5').toString(), // 5 USD worth of ETH/MATIC
    amountUsd: 5,
    winAmount: parseEther('9.5').toString(), // 9.5 after 5% fee
    winAmountUsd: 9.5,
    playersInQueue: 3,
    enabled: true,
  },
  {
    id: 1,
    amount: parseEther('10').toString(),
    amountUsd: 10,
    winAmount: parseEther('19').toString(),
    winAmountUsd: 19,
    playersInQueue: 5,
    enabled: true,
  },
  {
    id: 2,
    amount: parseEther('25').toString(),
    amountUsd: 25,
    winAmount: parseEther('47.5').toString(),
    winAmountUsd: 47.5,
    playersInQueue: 2,
    enabled: true,
  },
  {
    id: 3,
    amount: parseEther('50').toString(),
    amountUsd: 50,
    winAmount: parseEther('95').toString(),
    winAmountUsd: 95,
    playersInQueue: 1,
    enabled: true,
  },
  {
    id: 4,
    amount: parseEther('100').toString(),
    amountUsd: 100,
    winAmount: parseEther('190').toString(),
    winAmountUsd: 190,
    playersInQueue: 0,
    enabled: true,
  },
];

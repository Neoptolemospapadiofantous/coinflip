# Frontend Architecture & UX Implementation
## Complete Specification for React + Web3 Interface

---

## Document Purpose

This document provides everything needed to build the frontend application:
- Complete component architecture
- Web3 integration patterns
- UX flows and states
- Wallet connection
- Transaction handling
- Real-time updates
- Mobile-first responsive design

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Component Architecture](#3-component-architecture)
4. [Web3 Integration](#4-web3-integration)
5. [State Management](#5-state-management)
6. [Transaction Flows](#6-transaction-flows)
7. [UX States & Feedback](#7-ux-states--feedback)
8. [Animations & Interactions](#8-animations--interactions)
9. [Mobile Optimization](#9-mobile-optimization)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Technology Stack

### 1.1 Core Dependencies

```json
{
  "dependencies": {
    // React
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    
    // Web3 & Wallet
    "wagmi": "^2.5.0",
    "viem": "^2.7.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    
    // State Management
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.0",
    
    // Backend Integration
    "@supabase/supabase-js": "^2.38.0",
    
    // UI & Styling
    "tailwindcss": "^3.4.0",
    "framer-motion": "^10.16.0",
    "lucide-react": "^0.263.1",
    
    // Utilities
    "date-fns": "^3.0.0",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

### 1.2 Why Each Technology

| Technology | Purpose | Alternative |
|------------|---------|-------------|
| **wagmi** | Web3 hooks, wallet management | ethers.js (more manual) |
| **viem** | TypeScript-first Ethereum library | web3.js (older) |
| **RainbowKit** | Beautiful wallet connection UI | ConnectKit |
| **TanStack Query** | Server state, caching, refetching | SWR |
| **Zustand** | Client state (UI, modals) | Redux (overkill) |
| **Supabase** | Real-time DB, auth | Firebase |
| **Framer Motion** | Smooth animations | React Spring |
| **Tailwind** | Utility-first CSS | Styled Components |

---

## 2. Project Structure

### 2.1 Directory Layout

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Layout.tsx
│   │
│   ├── wallet/
│   │   ├── ConnectButton.tsx
│   │   ├── WalletInfo.tsx
│   │   └── NetworkSwitch.tsx
│   │
│   ├── game/
│   │   ├── TierSelector.tsx
│   │   ├── CoinChoice.tsx
│   │   ├── GameLobby.tsx
│   │   ├── ActiveGame.tsx
│   │   ├── CoinFlipAnimation.tsx
│   │   └── ResultScreen.tsx
│   │
│   ├── queue/
│   │   ├── QueueStatus.tsx
│   │   ├── MatchFound.tsx
│   │   └── QueueTimer.tsx
│   │
│   ├── transaction/
│   │   ├── TransactionStatus.tsx
│   │   ├── TransactionProgress.tsx
│   │   └── GasEstimate.tsx
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Modal.tsx
│       └── Spinner.tsx
│
├── hooks/
│   ├── useContract.ts
│   ├── useGame.ts
│   ├── useQueue.ts
│   ├── useTiers.ts
│   └── useSupabase.ts
│
├── lib/
│   ├── contracts/
│   │   ├── abi.ts
│   │   └── addresses.ts
│   ├── supabase.ts
│   └── utils.ts
│
├── store/
│   ├── gameStore.ts
│   ├── uiStore.ts
│   └── queueStore.ts
│
├── types/
│   ├── game.ts
│   ├── tier.ts
│   └── queue.ts
│
└── pages/
    ├── HomePage.tsx
    ├── PlayPage.tsx
    ├── HistoryPage.tsx
    └── StatsPage.tsx
```

### 2.2 File Naming Conventions

```
Components:     PascalCase.tsx    (GameLobby.tsx)
Hooks:          camelCase.ts      (useGame.ts)
Utilities:      camelCase.ts      (formatAddress.ts)
Types:          camelCase.ts      (game.ts)
Constants:      UPPER_SNAKE.ts    (CONTRACT_ADDRESSES.ts)
```

---

## 3. Component Architecture

### 3.1 Component Hierarchy

```
App
├── Layout
│   ├── Header
│   │   ├── ConnectButton
│   │   ├── WalletInfo
│   │   └── NetworkSwitch
│   └── Footer
│
└── Pages
    ├── HomePage
    │   ├── TierSelector
    │   └── QuickStats
    │
    ├── PlayPage
    │   ├── InstantMatchFlow
    │   │   ├── TierSelector
    │   │   ├── CoinChoice
    │   │   ├── QueueStatus
    │   │   ├── MatchFound
    │   │   ├── ActiveGame
    │   │   │   ├── TransactionProgress
    │   │   │   ├── CoinFlipAnimation
    │   │   │   └── ResultScreen
    │   │   └── RematchPrompt
    │   │
    │   └── PublicGameFlow
    │       ├── GameLobby
    │       └── CreateGameModal
    │
    └── HistoryPage
        ├── GameHistoryList
        └── GameDetailModal
```

### 3.2 Key Component Patterns

#### Pattern 1: Container/Presenter

```typescript
// Container Component (logic)
export function TierSelectorContainer() {
  const { tiers, loading } = useTiers();
  const { selectedTier, selectTier } = useGameStore();
  
  if (loading) return <TierSelectorSkeleton />;
  
  return (
    <TierSelectorPresenter
      tiers={tiers}
      selectedTier={selectedTier}
      onSelect={selectTier}
    />
  );
}

// Presenter Component (UI only)
interface TierSelectorPresenterProps {
  tiers: Tier[];
  selectedTier: number | null;
  onSelect: (tier: number) => void;
}

export function TierSelectorPresenter({
  tiers,
  selectedTier,
  onSelect
}: TierSelectorPresenterProps) {
  return (
    <div className="grid grid-cols-5 gap-4">
      {tiers.map((tier) => (
        <TierButton
          key={tier.id}
          tier={tier}
          selected={selectedTier === tier.id}
          onClick={() => onSelect(tier.id)}
        />
      ))}
    </div>
  );
}
```

#### Pattern 2: Compound Components

```typescript
// Flexible composition pattern
export function GameCard({ children }: { children: React.ReactNode }) {
  return <div className="game-card">{children}</div>;
}

GameCard.Header = function GameCardHeader({ children }) {
  return <div className="game-card-header">{children}</div>;
};

GameCard.Body = function GameCardBody({ children }) {
  return <div className="game-card-body">{children}</div>;
};

GameCard.Footer = function GameCardFooter({ children }) {
  return <div className="game-card-footer">{children}</div>;
};

// Usage
<GameCard>
  <GameCard.Header>
    <h3>$25 Coin Flip</h3>
  </GameCard.Header>
  <GameCard.Body>
    <p>Waiting for opponent...</p>
  </GameCard.Body>
  <GameCard.Footer>
    <Button>Cancel</Button>
  </GameCard.Footer>
</GameCard>
```

### 3.3 Core Component Examples

#### TierSelector Component

```typescript
// components/game/TierSelector.tsx
import { motion } from 'framer-motion';
import { useTiers } from '@/hooks/useTiers';
import { useGameStore } from '@/store/gameStore';
import { formatCurrency } from '@/lib/utils';

export function TierSelector() {
  const { data: tiers, isLoading } = useTiers();
  const { selectedTier, setSelectedTier } = useGameStore();
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });

  if (isLoading) {
    return <TierSelectorSkeleton />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Choose Your Bet</h2>
      
      <div className="grid grid-cols-5 gap-3">
        {tiers?.map((tier) => {
          const canAfford = balance 
            ? balance.value >= BigInt(tier.amount)
            : false;
          
          const isSelected = selectedTier === tier.id;
          
          return (
            <motion.button
              key={tier.id}
              whileHover={{ scale: canAfford ? 1.05 : 1 }}
              whileTap={{ scale: canAfford ? 0.95 : 1 }}
              onClick={() => canAfford && setSelectedTier(tier.id)}
              disabled={!canAfford}
              className={`
                relative p-6 rounded-xl border-2 transition-all
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200'
                }
                ${!canAfford && 'opacity-50 cursor-not-allowed'}
              `}
            >
              <div className="text-3xl font-bold">
                {formatCurrency(tier.amount)}
              </div>
              
              <div className="text-sm text-gray-600 mt-2">
                Win: {formatCurrency(tier.winAmount)}
              </div>
              
              {tier.playersInQueue > 0 && (
                <div className="absolute top-2 right-2">
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    {tier.playersInQueue}
                  </span>
                </div>
              )}
              
              {!canAfford && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-xl">
                  <span className="text-white text-sm">
                    Insufficient Balance
                  </span>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
      
      <div className="text-sm text-gray-600">
        Your balance: {formatCurrency(balance?.value || 0n)}
      </div>
    </div>
  );
}
```

#### CoinChoice Component

```typescript
// components/game/CoinChoice.tsx
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Coins } from 'lucide-react';

export function CoinChoice() {
  const { coinChoice, setCoinChoice } = useGameStore();

  const choices = [
    { value: false, label: 'Heads', icon: '🪙' },
    { value: true, label: 'Tails', icon: '🪙' }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Choose Your Side</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {choices.map((choice) => {
          const isSelected = coinChoice === choice.value;
          
          return (
            <motion.button
              key={choice.label}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCoinChoice(choice.value)}
              className={`
                p-8 rounded-xl border-2 transition-all
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="text-6xl mb-2">{choice.icon}</div>
              <div className="text-xl font-semibold">{choice.label}</div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 4. Web3 Integration

### 4.1 Wallet Configuration

```typescript
// lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonMumbai } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'CoinFlip',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID!,
  chains: [
    polygon,
    ...(process.env.NODE_ENV === 'development' ? [polygonMumbai] : [])
  ],
  ssr: false
});
```

### 4.2 Contract Interaction Hook

```typescript
// hooks/useContract.ts
import { useContractWrite, useWaitForTransaction } from 'wagmi';
import { COINFLIP_ABI } from '@/lib/contracts/abi';
import { COINFLIP_ADDRESS } from '@/lib/contracts/addresses';

export function useCreateGame() {
  const { 
    write: createGame, 
    data: txData,
    isLoading: isWriting 
  } = useContractWrite({
    address: COINFLIP_ADDRESS,
    abi: COINFLIP_ABI,
    functionName: 'createGame'
  });

  const { 
    isLoading: isConfirming,
    isSuccess 
  } = useWaitForTransaction({
    hash: txData?.hash
  });

  return {
    createGame,
    isLoading: isWriting || isConfirming,
    isSuccess,
    txHash: txData?.hash
  };
}

// Usage in component
function CreateGameButton() {
  const { createGame, isLoading } = useCreateGame();
  const { selectedTier, coinChoice } = useGameStore();

  const handleCreate = () => {
    createGame({
      args: [selectedTier, coinChoice],
      value: TIER_AMOUNTS[selectedTier]
    });
  };

  return (
    <button onClick={handleCreate} disabled={isLoading}>
      {isLoading ? 'Creating...' : 'Create Game'}
    </button>
  );
}
```

### 4.3 Contract Event Listening

```typescript
// hooks/useGameEvents.ts
import { useContractEvent } from 'wagmi';
import { COINFLIP_ABI, COINFLIP_ADDRESS } from '@/lib/contracts';

export function useGameCreatedEvents() {
  useContractEvent({
    address: COINFLIP_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'GameCreated',
    listener(log) {
      const { gameId, creator, tier, amount, choice } = log[0].args;
      
      // Update local state or trigger notification
      console.log('New game created:', { gameId, tier });
    }
  });
}

export function useGameResolvedEvents(gameId: bigint) {
  useContractEvent({
    address: COINFLIP_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'GameResolved',
    listener(log) {
      const event = log[0].args;
      
      if (event.gameId === gameId) {
        // Handle resolution
        showResultScreen(event);
      }
    }
  });
}
```

---

## 5. State Management

### 5.1 Game Store (Zustand)

```typescript
// store/gameStore.ts
import { create } from 'zustand';

interface GameState {
  // Current game flow
  selectedTier: number | null;
  coinChoice: boolean | null;
  activeGameId: bigint | null;
  
  // UI state
  showMatchModal: boolean;
  showResultModal: boolean;
  
  // Actions
  setSelectedTier: (tier: number | null) => void;
  setCoinChoice: (choice: boolean | null) => void;
  setActiveGameId: (id: bigint | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  selectedTier: null,
  coinChoice: null,
  activeGameId: null,
  showMatchModal: false,
  showResultModal: false,
  
  setSelectedTier: (tier) => set({ selectedTier: tier }),
  setCoinChoice: (choice) => set({ coinChoice: choice }),
  setActiveGameId: (id) => set({ activeGameId: id }),
  
  resetGame: () => set({
    selectedTier: null,
    coinChoice: null,
    activeGameId: null,
    showMatchModal: false,
    showResultModal: false
  })
}));
```

### 5.2 Queue Store

```typescript
// store/queueStore.ts
import { create } from 'zustand';

interface QueueState {
  isInQueue: boolean;
  queuedTier: number | null;
  joinedAt: Date | null;
  matchedWith: string | null;
  
  joinQueue: (tier: number) => void;
  leaveQueue: () => void;
  setMatch: (opponent: string) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  isInQueue: false,
  queuedTier: null,
  joinedAt: null,
  matchedWith: null,
  
  joinQueue: (tier) => set({
    isInQueue: true,
    queuedTier: tier,
    joinedAt: new Date()
  }),
  
  leaveQueue: () => set({
    isInQueue: false,
    queuedTier: null,
    joinedAt: null,
    matchedWith: null
  }),
  
  setMatch: (opponent) => set({ matchedWith: opponent })
}));
```

### 5.3 React Query for Server State

```typescript
// hooks/useTiers.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useTiers() {
  return useQuery({
    queryKey: ['tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tiers')
        .select('*')
        .eq('enabled', true)
        .order('id');
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000 // Refetch every 30s
  });
}

// hooks/useGameHistory.ts
export function useGameHistory(wallet: string) {
  return useQuery({
    queryKey: ['gameHistory', wallet],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .or(`player_a.eq.${wallet},player_b.eq.${wallet}`)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!wallet
  });
}
```

---

## 6. Transaction Flows

### 6.1 Create Game Flow

```typescript
// components/game/CreateGameFlow.tsx
import { useCreateGame } from '@/hooks/useContract';
import { useGameStore } from '@/store/gameStore';
import { TransactionProgress } from '@/components/transaction';

export function CreateGameFlow() {
  const { selectedTier, coinChoice } = useGameStore();
  const { createGame, isLoading, isSuccess, txHash } = useCreateGame();

  const handleCreate = async () => {
    try {
      await createGame({
        args: [selectedTier, coinChoice],
        value: TIER_AMOUNTS[selectedTier]
      });
    } catch (error) {
      toast.error('Transaction failed');
    }
  };

  if (isLoading) {
    return (
      <TransactionProgress
        status="pending"
        message="Creating game..."
        txHash={txHash}
      />
    );
  }

  if (isSuccess) {
    return <GameCreatedSuccess />;
  }

  return (
    <div>
      <TierSelector />
      <CoinChoice />
      <Button onClick={handleCreate}>
        Create Game
      </Button>
    </div>
  );
}
```

### 6.2 Transaction Status Component

```typescript
// components/transaction/TransactionProgress.tsx
import { CheckCircle, Loader, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface TransactionProgressProps {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  message: string;
  txHash?: string;
}

export function TransactionProgress({
  status,
  message,
  txHash
}: TransactionProgressProps) {
  const steps = [
    { id: 'wallet', label: 'Wallet approval', status: 'complete' },
    { id: 'submit', label: 'Transaction submitted', status: status === 'pending' ? 'active' : 'complete' },
    { id: 'confirm', label: 'Confirming on blockchain', status: status === 'confirming' ? 'active' : 'pending' },
    { id: 'complete', label: 'Complete', status: status === 'success' ? 'complete' : 'pending' }
  ];

  return (
    <div className="space-y-6 p-6 bg-white rounded-xl">
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            <StepIcon status={step.status} />
            <span className={`
              ${step.status === 'complete' ? 'text-green-600' : ''}
              ${step.status === 'active' ? 'text-blue-600 font-medium' : ''}
              ${step.status === 'pending' ? 'text-gray-400' : ''}
            `}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {txHash && (
        <div className="pt-4 border-t">
          <a
            href={`https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View on Explorer →
          </a>
        </div>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === 'complete') {
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  }
  if (status === 'active') {
    return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
  }
  return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
}
```

---

## 7. UX States & Feedback

### 7.1 Loading States

```typescript
// Skeleton Components
export function TierSelectorSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i}
          className="h-32 bg-gray-200 rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="p-6 bg-white rounded-xl space-y-4">
      <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
      <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
    </div>
  );
}
```

### 7.2 Empty States

```typescript
// components/EmptyState.tsx
import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon = <FileQuestion className="w-16 h-16 text-gray-400" />,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-gray-600 mb-6 max-w-md">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Usage
<EmptyState
  title="No games yet"
  description="Start your first coin flip game to see your history here."
  action={{
    label: "Play Now",
    onClick: () => router.push('/play')
  }}
/>
```

### 7.3 Error States

```typescript
// components/ErrorState.tsx
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  retry?: () => void;
}

export function ErrorState({ title, message, retry }: ErrorStateProps) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">{title}</h3>
          <p className="text-sm text-red-700 mb-3">{message}</p>
          {retry && (
            <button
              onClick={retry}
              className="text-sm text-red-600 font-medium hover:underline"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 7.4 Toast Notifications

```typescript
// lib/toast.ts
import toast from 'react-hot-toast';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'bottom-right',
      style: {
        background: '#10b981',
        color: '#fff'
      }
    });
  },
  
  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'bottom-right'
    });
  },
  
  loading: (message: string) => {
    return toast.loading(message, {
      position: 'bottom-right'
    });
  },
  
  txSubmitted: (txHash: string) => {
    toast((t) => (
      <div className="flex items-center gap-2">
        <span>Transaction submitted</span>
        <a
          href={`https://polygonscan.com/tx/${txHash}`}
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          View
        </a>
      </div>
    ), { duration: 5000 });
  }
};
```

---

## 8. Animations & Interactions

### 8.1 Coin Flip Animation

```typescript
// components/game/CoinFlipAnimation.tsx
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface CoinFlipAnimationProps {
  isFlipping: boolean;
  result?: boolean; // false = heads, true = tails
  onComplete?: () => void;
}

export function CoinFlipAnimation({
  isFlipping,
  result,
  onComplete
}: CoinFlipAnimationProps) {
  const [rotations, setRotations] = useState(0);

  useEffect(() => {
    if (isFlipping) {
      setRotations(10); // Spin 10 times
    } else if (result !== undefined) {
      // Land on result
      const finalRotation = result ? 180 : 0; // Tails = 180deg
      setRotations(10 + finalRotation / 360);
      
      setTimeout(() => {
        onComplete?.();
      }, 1000);
    }
  }, [isFlipping, result]);

  return (
    <div className="flex items-center justify-center h-64">
      <motion.div
        className="relative w-32 h-32"
        animate={{
          rotateY: rotations * 360
        }}
        transition={{
          duration: isFlipping ? 2 : 1,
          ease: isFlipping ? 'linear' : 'easeOut'
        }}
      >
        {/* Heads Side */}
        <div className="absolute inset-0 backface-hidden">
          <div className="w-full h-full bg-yellow-400 rounded-full flex items-center justify-center text-6xl">
            👑
          </div>
        </div>
        
        {/* Tails Side */}
        <div className="absolute inset-0 backface-hidden rotate-y-180">
          <div className="w-full h-full bg-yellow-400 rounded-full flex items-center justify-center text-6xl">
            🪙
          </div>
        </div>
      </motion.div>
    </div>
  );
}
```

### 8.2 Page Transitions

```typescript
// components/PageTransition.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={router.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## 9. Mobile Optimization

### 9.1 Responsive Design Patterns

```typescript
// Tailwind breakpoints: sm (640px), md (768px), lg (1024px)

// Desktop: 5 columns, Mobile: 2 columns
<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
  {tiers.map(tier => <TierButton key={tier.id} />)}
</div>

// Stack on mobile, side-by-side on desktop
<div className="flex flex-col md:flex-row gap-4">
  <CoinChoice />
  <GameInfo />
</div>

// Hide on mobile, show on desktop
<div className="hidden md:block">
  <AdvancedStats />
</div>

// Show on mobile only
<div className="md:hidden">
  <MobileMenu />
</div>
```

### 9.2 Touch-Optimized Interactions

```typescript
// Larger tap targets on mobile
<button className="
  px-4 py-2 md:px-6 md:py-3
  min-h-[44px]  // iOS minimum tap target
  text-base md:text-lg
">
  Create Game
</button>

// Swipe gestures
import { useSwipeable } from 'react-swipeable';

function GameCard() {
  const handlers = useSwipeable({
    onSwipedLeft: () => nextGame(),
    onSwipedRight: () => prevGame(),
    trackMouse: false // Touch only
  });

  return <div {...handlers}>...</div>;
}
```

### 9.3 Mobile Navigation

```typescript
// components/layout/MobileNav.tsx
export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Slide-out Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Menu */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-64 bg-white z-50 p-6"
            >
              <nav className="space-y-4">
                <NavLink href="/play">Play</NavLink>
                <NavLink href="/history">History</NavLink>
                <NavLink href="/stats">Stats</NavLink>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

---

## 10. Testing Strategy

### 10.1 Component Testing (Vitest + Testing Library)

```typescript
// components/TierSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TierSelector } from './TierSelector';
import { useGameStore } from '@/store/gameStore';

describe('TierSelector', () => {
  it('renders all tiers', () => {
    render(<TierSelector />);
    expect(screen.getByText('$5')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
  });

  it('selects tier on click', () => {
    render(<TierSelector />);
    const tier = screen.getByText('$25');
    
    fireEvent.click(tier);
    
    expect(useGameStore.getState().selectedTier).toBe(2);
  });

  it('disables tiers when balance insufficient', () => {
    // Mock low balance
    render(<TierSelector />);
    
    const highTier = screen.getByText('$100');
    expect(highTier).toBeDisabled();
  });
});
```

### 10.2 Integration Testing

```typescript
// e2e/game-flow.test.ts
import { test, expect } from '@playwright/test';

test('complete game flow', async ({ page }) => {
  // Connect wallet (using test wallet)
  await page.goto('/');
  await page.click('text=Connect Wallet');
  await page.click('text=MetaMask');
  
  // Select tier
  await page.click('text=$25');
  
  // Choose heads
  await page.click('text=Heads');
  
  // Create game
  await page.click('text=Play Now');
  
  // Wait for tx confirmation
  await page.waitForSelector('text=Game Created');
  
  // Verify game appears in lobby
  expect(await page.textContent('.game-card')).toContain('$25');
});
```

---

## Conclusion

This frontend architecture provides:

✅ **Type-safe Web3 integration** with wagmi + viem  
✅ **Responsive mobile-first design** with Tailwind  
✅ **Smooth animations** with Framer Motion  
✅ **Real-time updates** with Supabase  
✅ **Comprehensive state management** with Zustand + React Query  
✅ **Production-ready components** with error/loading states  
✅ **Optimistic UI updates** for better UX  
✅ **Full test coverage** strategy

**Next Steps:**
1. Set up project with Vite + React + TypeScript
2. Configure wagmi + RainbowKit
3. Implement core components following this architecture
4. Add animations and transitions
5. Test on mobile devices
6. Optimize bundle size


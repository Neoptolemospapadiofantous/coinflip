# CoinFlip System Architecture

## Overview

This document provides a comprehensive view of the CoinFlip application architecture.

---

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["🌐 CLIENT (Browser)"]
        subgraph Pages["Pages (app/)"]
            P1["/page.tsx<br/>Home/Play"]
            P2["/queue/page.tsx<br/>Game Queue"]
            P3["/history/page.tsx"]
            P4["/leaderboard/page.tsx"]
            P5["/stats/page.tsx"]
            P6["/settings/page.tsx"]
            P7["/dashboard/page.tsx"]
        end

        subgraph Components["Components"]
            C1["GameSessionModal"]
            C2["TierSelector"]
            C3["ActiveGamesPanel"]
            C4["ActivityFeed"]
            C5["Header/Layout"]
            C6["WalletButton"]
        end

        subgraph Providers["Providers (components/Providers.tsx)"]
            PR1["QueryClientProvider"]
            PR2["WagmiProvider"]
            PR3["ThemeProvider"]
            PR4["DataProvider"]
            PR5["GlobalErrorHandler"]
        end
    end

    subgraph Hooks["🪝 HOOKS LAYER"]
        H1["useGames<br/>usePlayerGames<br/>useActiveGames"]
        H2["useRealtimeStats<br/>usePendingByTier<br/>useActivityFeed"]
        H3["useContract<br/>useCreatedGameTracking"]
        H4["usePendingTransactions<br/>useGameLimits"]
        H5["useUserPreferences<br/>useNotificationState"]
        H6["useLeaderboard<br/>usePlayerRank"]
        H7["useRealtimeSync<br/>useGameSync"]
        H8["useAuth<br/>useSupabaseAuth"]
    end

    subgraph DataLayer["📊 DATA LAYER"]
        DL1["lib/queries/*<br/>Centralized Queries"]
        DL2["lib/validation/*<br/>Zod Schemas"]
        DL3["lib/realtime/*<br/>Subscription Registry"]
        DL4["lib/data/*<br/>Data Sources"]
    end

    subgraph State["🗄️ STATE"]
        ST1["React Query Cache"]
        ST2["Zustand Stores<br/>gameStore, uiStore"]
        ST3["Local Storage<br/>Preferences"]
    end

    subgraph External["🔗 EXTERNAL"]
        EX1["Supabase<br/>Database + Realtime"]
        EX2["Ethereum<br/>Sepolia Testnet"]
        EX3["Chainlink VRF<br/>Randomness"]
    end

    Pages --> Components
    Components --> Hooks
    Hooks --> DataLayer
    DataLayer --> State
    DataLayer --> External
    Providers --> Pages
```

---

## Detailed Layer Architecture

### 1. Types Layer (Single Source of Truth)

```mermaid
flowchart LR
    subgraph Types["types/"]
        T1["database.ts<br/>━━━━━━━━━━━━━<br/>DbGame<br/>DbTier<br/>DbUserPreferences<br/>DbPendingTransaction<br/>DbActivityFeed<br/>DbGameStatistics<br/>DbPendingByTier<br/>DbTierMatchStats<br/>━━━━━━━━━━━━━<br/>DB_COLUMNS<br/>Type Guards"]
        T2["game.ts<br/>━━━━━━━━━━━━━<br/>Game interface<br/>GameStatus enum<br/>parseGame()<br/>isValidGame()"]
        T3["tier.ts<br/>━━━━━━━━━━━━━<br/>Tier interface<br/>TIER_IDS"]
    end

    T1 --> T2
    T1 --> T3
```

### 2. Queries Layer (Centralized)

```mermaid
flowchart TB
    subgraph Queries["lib/queries/"]
        Q1["games.ts<br/>━━━━━━━━━━━━━<br/>queryAllGames()<br/>queryPendingGames()<br/>queryActiveGames()<br/>queryPlayerGames()<br/>queryUserActiveGames()<br/>queryGameById()"]

        Q2["stats.ts<br/>━━━━━━━━━━━━━<br/>queryGameStats()<br/>queryPendingByTier()<br/>queryTierMatchStats()<br/>queryActivityFeed()<br/>queryIndexerState()<br/>queryPlayerStats()<br/>queryLeaderboard()"]

        Q3["user.ts<br/>━━━━━━━━━━━━━<br/>queryUserPreferences()<br/>upsertUserPreferences()<br/>queryPendingTransactions()<br/>createPendingTransaction()<br/>queryUserGameNotifications()"]

        QI["index.ts<br/>Re-exports all"]
    end

    Q1 --> QI
    Q2 --> QI
    Q3 --> QI
```

### 3. Validation Layer

```mermaid
flowchart TB
    subgraph Validation["lib/validation/"]
        V1["schemas.ts<br/>━━━━━━━━━━━━━<br/>Zod Schemas:<br/>DbGameSchema<br/>DbTierSchema<br/>DbActivityFeedSchema<br/>DbPendingByTierSchema<br/>DbGameStatisticsSchema<br/>DbLeaderboardEntrySchema"]

        V2["parse.ts<br/>━━━━━━━━━━━━━<br/>parseDbGame()<br/>parseDbGames()<br/>parseDbTier()<br/>parseDbActivityFeed()<br/>parseDbPendingByTier()<br/>parseDbGameStatistics()"]
    end

    V1 --> V2
```

### 4. Realtime Layer

```mermaid
flowchart TB
    subgraph Realtime["lib/realtime/"]
        R1["registry.ts<br/>━━━━━━━━━━━━━<br/>REALTIME_CHANNELS:<br/>• GLOBAL_GAME_SYNC<br/>• ACTIVITY_FEED<br/>• INDEXER_STATE<br/>• PENDING_BY_TIER<br/>• MATCH_TIMES<br/>━━━━━━━━━━━━━<br/>Channel Tracking<br/>Query Key Mappings"]
    end

    subgraph Subscriptions["Active Subscriptions"]
        S1["games table<br/>INSERT/UPDATE/DELETE"]
        S2["activity_feed table<br/>INSERT"]
        S3["indexer_state table<br/>UPDATE"]
        S4["pending_transactions<br/>Per-user channel"]
    end

    R1 --> S1
    R1 --> S2
    R1 --> S3
    R1 --> S4
```

---

## Hooks Architecture

```mermaid
flowchart TB
    subgraph GameHooks["Game Data Hooks"]
        GH1["useGames()"]
        GH2["usePendingGames()"]
        GH3["useActiveGames()"]
        GH4["usePlayerGames()"]
        GH5["useUserActiveGames()"]
        GH6["useGame()"]
        GH7["useGameStats()"]
        GH8["usePlayerStats()"]
    end

    subgraph RealtimeHooks["Realtime Hooks"]
        RH1["useRealtimeStats()"]
        RH2["usePendingByTier()"]
        RH3["useTierMatchTimes()"]
        RH4["useActivityFeed()"]
        RH5["useIndexerStatus()"]
        RH6["useRealtimeSync()"]
    end

    subgraph TransactionHooks["Transaction Hooks"]
        TH1["usePendingTransactions()"]
        TH2["useGameLimits()"]
        TH3["useCreatedGameTracking()"]
        TH4["useOptimisticUpdates()"]
    end

    subgraph ContractHooks["Contract Hooks"]
        CH1["useContract()"]
        CH2["useGameTimeout()"]
        CH3["useActiveGameMonitor()"]
        CH4["useGameSync()"]
    end

    subgraph UserHooks["User Hooks"]
        UH1["useUserPreferences()"]
        UH2["useNotificationState()"]
        UH3["useAuth()"]
        UH4["useSupabaseAuth()"]
        UH5["useWalletChangeDetection()"]
    end

    subgraph LeaderboardHooks["Leaderboard Hooks"]
        LH1["useLeaderboard()"]
        LH2["usePlayerRank()"]
        LH3["useLeaderboardStats()"]
    end

    subgraph UtilityHooks["Utility Hooks"]
        UTH1["useTiers()"]
        UTH2["useSharedTimer()"]
        UTH3["useWindowSize()"]
    end
```

---

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant H as Hook
    participant Q as Query Function
    participant V as Validator
    participant S as Supabase
    participant RT as Realtime
    participant BC as Blockchain

    Note over U,BC: READ FLOW (Supabase)
    U->>C: View Page
    C->>H: useGames()
    H->>Q: queryAllGames()
    Q->>S: SELECT from games
    S-->>Q: Raw Data
    Q-->>H: Data
    H->>V: parseDbGames()
    V-->>H: Validated Games
    H-->>C: Game[]
    C-->>U: Render UI

    Note over U,BC: WRITE FLOW (Blockchain)
    U->>C: Create Game
    C->>H: useContract()
    H->>BC: createGame(tier, choice)
    BC-->>H: TX Hash
    H->>Q: createPendingTransaction()
    Q->>S: INSERT pending_tx

    Note over U,BC: REALTIME UPDATE
    BC->>BC: TX Confirmed
    BC->>S: Indexer writes game
    S->>RT: games INSERT event
    RT->>H: Realtime callback
    H->>H: Invalidate queries
    H-->>C: Updated data
    C-->>U: UI updates
```

---

## Component Hierarchy

```mermaid
flowchart TB
    subgraph RootLayout["app/layout.tsx"]
        Providers["Providers.tsx"]

        subgraph ProviderStack["Provider Stack"]
            QCP["QueryClientProvider"]
            WP["WagmiProvider"]
            TP["ThemeProvider"]
            DP["DataProvider"]
            GEH["GlobalErrorHandler"]
            RTS["useRealtimeSync"]
        end
    end

    subgraph Pages["Pages"]
        Home["page.tsx (Home)"]
        Queue["queue/page.tsx"]
        History["history/page.tsx"]
        Leaderboard["leaderboard/page.tsx"]
        Stats["stats/page.tsx"]
        Settings["settings/page.tsx"]
        Dashboard["dashboard/page.tsx"]
    end

    subgraph GameComponents["Game Components"]
        GSM["GameSessionModal"]
        TS["TierSelector"]
        AGP["ActiveGamesPanel"]
        AF["ActivityFeed"]
        CC["CoinChoice"]
        CF["CoinFlip2D"]
        SB["StatusBadge"]
    end

    subgraph LayoutComponents["Layout Components"]
        Header["Header"]
        Footer["Footer"]
        Sidebar["Sidebar"]
        AL["AppLayout"]
    end

    subgraph UIComponents["UI Components"]
        WB["WalletButton"]
        NI["NetworkIndicator"]
        CSB["ConnectionStatusBanner"]
        SS["SyncStatus"]
        ST["SoundToggle"]
        ThS["ThemeSwitcher"]
    end

    Providers --> ProviderStack
    ProviderStack --> Pages
    Pages --> GameComponents
    Pages --> LayoutComponents
    LayoutComponents --> UIComponents
```

---

## State Management

```mermaid
flowchart TB
    subgraph ReactQuery["React Query (Server State)"]
        RQ1["games cache"]
        RQ2["pending-games cache"]
        RQ3["active-games cache"]
        RQ4["player-stats cache"]
        RQ5["leaderboard cache"]
        RQ6["activity-feed cache"]
        RQ7["pending-by-tier cache"]
    end

    subgraph Zustand["Zustand (Client State)"]
        Z1["gameStore<br/>━━━━━━━━━━━━━<br/>selectedTier<br/>selectedChoice<br/>isCreating<br/>isJoining<br/>currentGameId<br/>optimisticGames"]

        Z2["uiStore<br/>━━━━━━━━━━━━━<br/>sidebarOpen<br/>activeModal<br/>notifications<br/>theme"]
    end

    subgraph LocalStorage["Local Storage"]
        LS1["userPreferences<br/>(synced to Supabase)"]
        LS2["walletState<br/>(wagmi)"]
        LS3["theme"]
    end

    subgraph Realtime["Realtime Invalidation"]
        RT1["games:* → invalidate games/*"]
        RT2["activity_feed:INSERT → invalidate activity-feed"]
        RT3["indexer_state:UPDATE → invalidate indexer-state"]
    end

    Realtime --> ReactQuery
```

---

## External Services

```mermaid
flowchart TB
    subgraph Supabase["Supabase"]
        subgraph Tables["Tables"]
            T1["games"]
            T2["tiers"]
            T3["user_preferences"]
            T4["pending_transactions"]
            T5["user_game_notifications"]
            T6["activity_feed"]
            T7["indexer_state"]
        end

        subgraph Views["Views"]
            V1["game_statistics"]
            V2["pending_games_by_tier"]
            V3["tier_match_stats"]
        end

        subgraph RPCs["RPC Functions"]
            R1["get_player_stats_v2"]
            R2["get_leaderboard_by_*"]
            R3["get_player_rank"]
            R4["get_realtime_stats"]
            R5["cleanup_expired_pending_transactions"]
        end

        subgraph Realtime["Realtime"]
            RT["Postgres Changes<br/>WebSocket"]
        end
    end

    subgraph Blockchain["Ethereum (Sepolia)"]
        subgraph Contract["CoinFlip Contract"]
            CF1["createGame()"]
            CF2["joinGame()"]
            CF3["cancelGame()"]
            CF4["fulfillRandomWords()"]
        end

        subgraph Chainlink["Chainlink VRF"]
            CL1["Request Random"]
            CL2["Callback"]
        end

        subgraph Indexer["Event Indexer"]
            IX1["GameCreated"]
            IX2["GameJoined"]
            IX3["GameResolved"]
            IX4["GameCancelled"]
        end
    end

    Contract --> Chainlink
    Chainlink --> Contract
    Contract --> Indexer
    Indexer --> Tables
```

---

## File Structure Overview

```
coinflip/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Home/Play page
│   ├── queue/page.tsx           # Game queue
│   ├── history/page.tsx         # Game history
│   ├── leaderboard/page.tsx     # Leaderboards
│   ├── stats/page.tsx           # Statistics
│   ├── settings/page.tsx        # User settings
│   ├── dashboard/page.tsx       # Dashboard
│   └── api/                     # API routes
│       ├── health/route.ts      # Health check
│       └── rpc/route.ts         # RPC endpoint
│
├── components/
│   ├── Providers.tsx            # All providers + error handler
│   ├── game/                    # Game-specific components
│   │   ├── GameSessionModal.tsx
│   │   ├── TierSelector.tsx
│   │   ├── ActiveGamesPanel.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── CoinChoice.tsx
│   │   └── CoinFlip2D.tsx
│   ├── layout/                  # Layout components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── AppLayout.tsx
│   └── ui/                      # Reusable UI components
│       ├── WalletButton.tsx
│       ├── NetworkIndicator.tsx
│       └── SyncStatus.tsx
│
├── hooks/                        # Custom React hooks
│   ├── useGames.ts              # Game data hooks
│   ├── useRealtimeStats.ts      # Realtime stats hooks
│   ├── useContract.ts           # Contract interactions
│   ├── usePendingTransactions.ts
│   ├── useUserPreferences.ts
│   ├── useLeaderboard.ts
│   ├── useRealtimeSync.tsx      # Central realtime sync
│   └── ...
│
├── lib/                          # Shared utilities
│   ├── supabase.ts              # Supabase client
│   ├── wagmi.ts                 # Wagmi config
│   ├── queries/                 # ✨ NEW: Centralized queries
│   │   ├── index.ts
│   │   ├── games.ts
│   │   ├── stats.ts
│   │   └── user.ts
│   ├── validation/              # ✨ NEW: Zod validation
│   │   ├── index.ts
│   │   ├── schemas.ts
│   │   └── parse.ts
│   ├── realtime/                # ✨ NEW: Realtime registry
│   │   ├── index.ts
│   │   └── registry.ts
│   ├── data/                    # Data layer abstraction
│   │   ├── blockchain.ts
│   │   ├── supabase-source.ts
│   │   ├── provider.tsx
│   │   └── types.ts
│   ├── contracts/               # Contract ABIs & addresses
│   ├── auth/                    # Auth utilities
│   ├── constants.ts
│   ├── queryKeys.ts
│   └── utils.ts
│
├── types/                        # ✨ ENHANCED: Type definitions
│   ├── database.ts              # Single source of truth
│   ├── game.ts
│   └── tier.ts
│
├── store/                        # Zustand stores
│   ├── gameStore.ts
│   └── uiStore.ts
│
├── scripts/                      # CLI scripts
│   ├── event-indexer.ts         # Blockchain indexer
│   ├── deploy.ts
│   └── ...
│
├── contracts/                    # Solidity contracts
│   └── CoinFlip.sol
│
├── tests/                        # Test files
│   ├── unit/
│   ├── contracts/
│   └── api/
│
└── docs/                         # Documentation
    └── architecture/
        └── SYSTEM_ARCHITECTURE.md  # This file
```

---

## Authentication Architecture

### Overview

CoinFlip uses **wallet-based authentication** without traditional username/password. The user's Ethereum wallet address serves as their identity.

```mermaid
flowchart TB
    subgraph Browser["🌐 Browser"]
        W["Wallet (MetaMask)"]
        RK["RainbowKit UI"]
        WG["Wagmi Hooks"]
        AC["Authenticated<br/>Supabase Client"]
    end

    subgraph Supabase["☁️ Supabase"]
        RLS["RLS Policies"]
        GCA["get_caller_address()"]
        Tables["Protected Tables"]
    end

    W -->|"Connect"| RK
    RK -->|"useAccount()"| WG
    WG -->|"address"| AC
    AC -->|"x-wallet-address header"| RLS
    RLS -->|"Calls"| GCA
    GCA -->|"Validates"| Tables
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Wallet
    participant RK as RainbowKit
    participant WG as Wagmi
    participant SC as Supabase Client
    participant RLS as RLS Policy
    participant DB as Database

    Note over U,DB: 1. WALLET CONNECTION
    U->>W: Click "Connect Wallet"
    W->>RK: Show wallet options
    U->>RK: Select MetaMask
    RK->>W: Request connection
    W->>U: Approve connection
    W-->>RK: Connected (address)
    RK-->>WG: Update state
    WG-->>U: useAccount() returns address

    Note over U,DB: 2. AUTHENTICATED REQUEST
    U->>SC: Create pending transaction
    SC->>SC: getAuthenticatedClient(address)
    SC->>RLS: POST /pending_transactions<br/>Header: x-wallet-address: 0x...
    RLS->>RLS: get_caller_address()
    RLS->>RLS: Extract header value
    RLS->>RLS: Compare with user_address
    alt Address matches
        RLS->>DB: Allow INSERT
        DB-->>SC: Success
        SC-->>U: Transaction created
    else Address mismatch
        RLS-->>SC: 403 Forbidden
        SC-->>U: RLS Policy Error
    end
```

### Key Components

#### 1. Wallet Connection (Client-Side)

```typescript
// lib/wagmi.ts - Wagmi configuration
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

// components/ui/WalletButton.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
// RainbowKit provides the connect UI
```

#### 2. Authenticated Supabase Client

```typescript
// lib/supabase.ts

// Base client (NO wallet header - for public queries)
export const supabase = createClient(url, anonKey);

// Authenticated client (WITH wallet header - for RLS-protected queries)
export function getAuthenticatedClient(walletAddress: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: {
      headers: {
        'x-wallet-address': walletAddress.toLowerCase(),
      },
    },
  });
}
```

#### 3. Using Authenticated Client in Hooks

```typescript
// hooks/usePendingTransactions.ts

export function usePendingTransactions() {
  const { address } = useAccount(); // From wagmi

  // Create authenticated client with wallet header
  const authClient = useMemo(() => {
    if (!address) return null;
    return getAuthenticatedClient(address);
  }, [address]);

  // Use authClient for all RLS-protected operations
  const createMutation = useMutation({
    mutationFn: async (input) => {
      const { data, error } = await authClient  // ✅ Uses authenticated client
        .from('pending_transactions')
        .insert({ user_address: address.toLowerCase(), ... })
        .select()
        .single();
    },
  });
}
```

#### 4. RLS Policy (Database-Side)

```sql
-- Migration 031: RLS Security

-- Helper function to extract wallet address from request
CREATE OR REPLACE FUNCTION get_caller_address()
RETURNS TEXT AS $$
DECLARE
  header_wallet TEXT;
BEGIN
  -- Extract x-wallet-address header
  header_wallet := current_setting('request.headers', true)::json->>'x-wallet-address';

  -- Validate it's a valid Ethereum address
  IF header_wallet IS NOT NULL AND header_wallet ~ '^0x[a-fA-F0-9]{40}$' THEN
    RETURN lower(header_wallet);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS Policy: Users can only access their own data
CREATE POLICY "pending_transactions_insert"
  ON pending_transactions FOR INSERT
  WITH CHECK (
    lower(user_address) = get_caller_address()
  );
```

### Protected vs Public Tables

| Table | RLS | Access Pattern |
|-------|-----|----------------|
| `games` | Public READ | Anyone can view games |
| `tiers` | Public READ | Anyone can view tiers |
| `activity_feed` | Public READ | Anyone can view activity |
| `pending_transactions` | **User-only** | Only owner can CRUD |
| `user_preferences` | **User-only** | Only owner can CRUD |
| `user_game_notifications` | **User-only** | Only owner can CRUD |

### Auth Flow by Feature

```mermaid
flowchart LR
    subgraph Public["Public (No Auth)"]
        P1["View games"]
        P2["View leaderboard"]
        P3["View activity feed"]
        P4["View statistics"]
    end

    subgraph WalletRequired["Wallet Required"]
        W1["Create game"]
        W2["Join game"]
        W3["Cancel game"]
    end

    subgraph RLSProtected["RLS Protected"]
        R1["Save preferences"]
        R2["Track pending tx"]
        R3["Notification state"]
    end

    P1 --> |"supabase"| DB1[(Supabase)]
    W1 --> |"wagmi"| BC[(Blockchain)]
    R1 --> |"authClient"| DB2[(Supabase + RLS)]
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `403 Forbidden` on INSERT | Missing `x-wallet-address` header | Use `getAuthenticatedClient(address)` |
| `get_caller_address()` returns NULL | Invalid or missing header | Ensure address is lowercase, valid format |
| RLS blocks own data | Address case mismatch | Always use `.toLowerCase()` |
| Auth works in dev, fails in prod | Client not passing header | Check client instantiation |

### Security Considerations

1. **No Private Keys**: App never accesses wallet private keys
2. **Signature Verification**: For high-security ops, require signed messages
3. **Address Validation**: RLS validates address format (0x + 40 hex chars)
4. **Case Normalization**: All addresses stored/compared as lowercase
5. **Rate Limiting**: Client-side rate limits on game creation/joining

---

## Key Relationships

| Layer | Depends On | Used By |
|-------|-----------|---------|
| `types/database.ts` | - | Everything |
| `lib/queries/*` | `types/database.ts`, `lib/supabase.ts` | Hooks |
| `lib/validation/*` | `types/database.ts` | Hooks, Queries |
| `lib/realtime/*` | `lib/supabase.ts` | Hooks |
| `hooks/*` | Queries, Validation, Realtime | Components |
| `store/*` | - | Components, Hooks |
| `components/*` | Hooks, Store | Pages |
| `app/*` | Components | - |

---

## Data Flow Summary

1. **Types First**: All database types defined in `types/database.ts`
2. **Centralized Queries**: `lib/queries/*` contains all Supabase query functions
3. **Runtime Validation**: `lib/validation/*` validates data with Zod schemas
4. **Hooks Consume**: Hooks use queries and validation, return typed data
5. **Components Render**: Components call hooks, display data
6. **Realtime Updates**: Subscriptions invalidate React Query cache
7. **State Synced**: Zustand for UI state, React Query for server state

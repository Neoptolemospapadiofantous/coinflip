# CoinFlip — Full Architecture Document

> Generated: 2026-05-03 | Version: Contract V4

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Complete File Tree](#complete-file-tree)
3. [Architecture Flowchart](#architecture-flowchart)
4. [Smart Contract Architecture](#smart-contract-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend & API](#backend--api)
7. [Database Schema](#database-schema)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [External Services](#external-services)
10. [Security Model](#security-model)
11. [Deployment Architecture](#deployment-architecture)

---

## System Overview

CoinFlip is a **non-custodial, provably-fair peer-to-peer coin flip gambling platform** built on Ethereum/Polygon. Two players bet equal amounts on a coin flip outcome; Chainlink VRF provides verifiable randomness; the winner receives the pot minus a 3% platform fee.

**Key Properties:**
- Non-custodial: funds never leave user wallets except via smart contract
- Provably fair: randomness from Chainlink VRF V2.5 (auditable on-chain)
- Dual-mode: works with wallet-only (decentralized) or with email login (premium)
- Real-time: WebSocket subscriptions keep both players synchronized

**Tech Stack:**

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.20, Hardhat, OpenZeppelin, Chainlink VRF V2.5 |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind, Radix UI |
| Wallet | wagmi 2, viem 2, RainbowKit 2 |
| State | Zustand 5, TanStack Query 5 |
| Database | Supabase (PostgreSQL + Realtime + Auth) |
| Error Tracking | Sentry 10 |
| Hosting | Vercel (frontend), Supabase Cloud (DB), Node.js VPS (indexer) |

---

## Complete File Tree

```
coinflip/
│
├── app/                              # Next.js App Router
│   ├── page.tsx                      # Landing page — live stats, tier queue counts
│   ├── layout.tsx                    # Root layout with all providers
│   ├── play/page.tsx                 # Game creation (3-step: tier → choice → confirm)
│   ├── queue/page.tsx                # Open games waiting for opponents (join here)
│   ├── dashboard/page.tsx            # User's active games + recent history
│   ├── history/page.tsx              # Paginated game history with filters + CSV export
│   ├── leaderboard/page.tsx          # Top players by wins, volume, win rate
│   ├── stats/page.tsx                # Personal statistics (P&L, win rate)
│   ├── notifications/page.tsx        # Game activity feed + email preferences
│   ├── settings/page.tsx             # Theme, sound, notification preferences
│   ├── login/page.tsx                # Email/password login
│   ├── register/page.tsx             # Account registration
│   ├── forgot-password/page.tsx      # Password reset
│   ├── auth/callback/route.ts        # Supabase OAuth2 callback handler
│   ├── api/
│   │   ├── rpc/route.ts              # ★ JSON-RPC proxy (rate limit, cache, allowlist)
│   │   └── health/route.ts           # Health check (DB + RPC + indexer)
│   └── providers.tsx                 # Client providers wrapper
│
├── components/
│   ├── game/
│   │   ├── TierSelector.tsx          # Bet amount picker (shows USD equivalent)
│   │   ├── CoinChoice.tsx            # Heads/Tails visual selector
│   │   ├── CoinFlip2D.tsx            # Canvas coin flip animation
│   │   ├── GameSessionModal.tsx      # Result modal (win/lose/pending)
│   │   ├── ActiveGamesPanel.tsx      # Collapsible list of user's active games
│   │   ├── ActivityFeed.tsx          # Live feed of all game events
│   │   ├── StatusBadge.tsx           # Game status pill (pending/matched/resolved)
│   │   └── GameMonitor.tsx           # Monitors active games for updates
│   ├── layout/
│   │   ├── AppLayout.tsx             # Main layout with sidebar + header
│   │   ├── DashboardLayout.tsx       # Dashboard-specific layout
│   │   ├── Header.tsx                # Top nav (wallet button, network, sync status)
│   │   ├── Sidebar.tsx               # Left navigation
│   │   └── Footer.tsx                # Footer links
│   ├── providers/
│   │   ├── ClientProviders.tsx       # wagmi + RainbowKit + QueryClient + Sentry
│   │   └── ThemeProvider.tsx         # next-themes dark/light mode
│   ├── ui/
│   │   ├── WalletButton.tsx          # RainbowKit connect button
│   │   ├── NetworkIndicator.tsx      # Chain/network display
│   │   ├── SyncStatus.tsx            # Indexer sync status indicator
│   │   ├── SoundToggle.tsx           # Sound on/off
│   │   ├── MusicToggle.tsx           # Background music on/off
│   │   ├── ThemeSwitcher.tsx         # Dark/light toggle
│   │   ├── CopyableGameId.tsx        # Click-to-copy game ID
│   │   └── Toaster.tsx               # react-hot-toast container
│   ├── stats/
│   │   └── StatsCards.tsx            # Win/loss/profit stat cards
│   ├── shared/
│   │   ├── RecentGamesTable.tsx      # Sortable/filterable game table
│   │   ├── FilterControls.tsx        # Status + tier + date filters
│   │   └── ExportButton.tsx          # CSV export
│   ├── effects/
│   │   └── Confetti.tsx              # Win confetti animation
│   ├── ErrorBoundary.tsx             # React error boundary
│   └── WebVitals.tsx                 # Core Web Vitals reporter
│
├── hooks/
│   ├── useContract.ts                # ★ All contract write/read hooks
│   ├── useGames.ts                   # Game list queries (React Query)
│   ├── useTiers.ts                   # Tier data + USD conversion
│   ├── useCreatedGameTracking.ts     # Poll DB until created game is indexed
│   ├── useGameSync.tsx               # Real-time game state synchronization
│   ├── useGameTimeout.ts             # Countdown timer for game timeouts
│   ├── useActiveGameMonitor.ts       # Background monitor for active game updates
│   ├── usePendingTransactions.ts     # Track pending TXs in DB
│   ├── useRealtimeStats.ts           # Live queue counts + match time estimates
│   ├── useLeaderboard.ts             # Leaderboard data
│   ├── useNotificationState.ts       # Deduplicate notifications across tabs
│   ├── useOptimisticUpdates.ts       # Optimistic UI state management
│   ├── useUserPreferences.ts         # User settings (sound, theme, last game)
│   ├── useAuth.ts                    # Supabase auth state + actions
│   ├── useWalletChangeDetection.ts   # Detect wallet/chain switches
│   ├── useSharedTimer.ts             # Shared countdown timer component
│   └── useWindowSize.ts              # Window dimensions
│
├── lib/
│   ├── constants.ts                  # ★ All timing/config constants (single source)
│   ├── contracts/
│   │   ├── abi.ts                    # Contract ABI + GameState enum
│   │   └── addresses.ts              # Contract addresses by chain ID
│   ├── data/
│   │   ├── index.ts                  # Data layer exports
│   │   ├── provider.tsx              # DataContext (mode detection + feature flags)
│   │   ├── blockchain.ts             # Decentralized data source (RPC reads)
│   │   ├── supabase-source.ts        # Centralized data source (Supabase)
│   │   └── types.ts                  # Data source interface types
│   ├── queries/
│   │   ├── games.ts                  # Supabase game queries
│   │   ├── stats.ts                  # Statistics queries
│   │   ├── user.ts                   # User queries
│   │   ├── cache-config.ts           # React Query cache configuration
│   │   └── index.ts                  # Query exports
│   ├── realtime/
│   │   ├── index.ts                  # Realtime subscription hub
│   │   └── registry.ts               # Subscription deduplication registry
│   ├── auth/
│   │   ├── index.ts                  # Auth exports
│   │   └── supabase-auth.ts          # Supabase auth client
│   ├── validation/
│   │   ├── index.ts                  # Validation exports
│   │   ├── schemas.ts                # Zod schemas
│   │   └── parse.ts                  # Parsing utilities
│   ├── chainConfig.ts                # Chain definitions (Sepolia, Polygon, Amoy)
│   ├── env.ts                        # Validated environment variables
│   ├── errors.ts                     # Error classification helpers
│   ├── security.ts                   # ★ Rate limiters, sanitizers, validators
│   ├── supabase.ts                   # Supabase client (anon + service role)
│   ├── wagmi.ts                      # wagmi configuration
│   ├── utils.ts                      # General utilities (devLog, etc.)
│   ├── toast.ts                      # Toast deduplication
│   ├── music.ts                      # Background music controller
│   ├── sounds.ts                     # Sound effects controller
│   ├── theme.ts                      # Theme utilities
│   ├── networkUtils.ts               # Network/RPC utilities
│   ├── queryUtils.ts                 # Query helper utilities
│   ├── queryKeys.ts                  # React Query key factory
│   ├── dbHealthCheck.ts              # Database health check
│   └── mockData.ts                   # Mock data for dev/testing
│
├── store/
│   └── gameStore.ts                  # Zustand store (tier, choice, modals, active games)
│
├── types/
│   ├── game.ts                       # Game type + parseGame validator
│   ├── tier.ts                       # Tier type definitions
│   └── database.ts                   # Supabase DB schema types (generated)
│
├── scripts/
│   ├── event-indexer.ts              # ★ Blockchain → Supabase event indexer (daemon)
│   ├── deploy.ts                     # Contract deployment (mainnet/testnet)
│   ├── deploy-local.ts               # Local Hardhat deployment
│   ├── initialize-tiers.ts           # Set up bet tiers on deployed contract
│   ├── verify-db.ts                  # Database integrity check
│   ├── verify-production-setup.ts    # Pre-launch validation
│   ├── security-audit.ts             # Automated security checks
│   ├── sync-stale-games.ts           # Sync games that indexer missed
│   ├── reset-indexer-state.ts        # Reset indexer block pointer
│   └── cancel-expired-games.ts       # Manual batch cancel expired games
│
├── supabase/migrations/              # 36 SQL migrations (001–036)
│   ├── 001_initial_schema.sql        # Base tables
│   ├── 002_games_table.sql           # Games table + indexes
│   ├── 019_pending_transactions.sql  # Pending TX tracking
│   ├── 023_enhanced_player_stats.sql # Player stats view
│   └── 036_realtime_performance_indexes.sql  # Latest performance indexes
│
├── contracts/
│   └── CoinFlip.sol                  # ★ Main smart contract (1177 lines, V4)
│
├── tests/
│   ├── contracts/CoinFlip.test.ts    # Contract unit tests
│   ├── api/rpc.test.ts               # RPC proxy tests
│   └── setup.ts                      # Test setup
│
├── docs/                             # Documentation
├── artifacts/                        # Compiled contract artifacts
├── typechain-types/                  # Generated TypeScript contract types
│
├── middleware.ts                     # ★ Security headers + CSP + rate limiting
├── instrumentation.ts                # Sentry instrumentation
├── package.json                      # Dependencies (47 prod deps)
├── hardhat.config.ts                 # Hardhat (Solidity compiler + networks)
├── tsconfig.json                     # TypeScript config
├── tailwind.config.ts                # Tailwind + custom theme
├── next.config.js                    # Next.js (standalone, turbopack, Sentry)
├── vercel.json                       # Vercel deployment config
└── .env.example                      # Required environment variables
```

---

## Architecture Flowchart

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         COINFLIP SYSTEM ARCHITECTURE                      ║
╚══════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                 │
│                                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │  Next.js App  │    │   wagmi +    │    │   Supabase Realtime      │   │
│  │  (React 19)   │◄──►│   RainbowKit │    │   WebSocket Client       │   │
│  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘   │
│         │                   │                          │                  │
│  ┌──────▼───────────────────▼──────────────────────────▼─────────────┐  │
│  │                     State Layer                                      │  │
│  │  Zustand Store │ TanStack Query │ React Context (DataProvider)      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────┬───────────────────────────┘
                            │                 │
              ┌─────────────▼──┐     ┌────────▼──────────────────┐
              │  /api/rpc       │     │   Supabase Cloud           │
              │  (RPC Proxy)   │     │   (PostgreSQL + Realtime)  │
              │  Rate Limited  │     │   wss://*.supabase.co      │
              └──────┬─────────┘     └────────┬──────────────────┘
                     │                        │ ▲
              ┌──────▼─────────┐              │ │ WebSocket events
              │  Alchemy RPC   │              │ │ (game updates)
              │  (Ethereum     │     ┌────────▼─┴──────────────────┐
              │   Sepolia /    │     │    Event Indexer Daemon       │
              │   Polygon)     │     │    (Node.js process)          │
              └──────┬─────────┘     │    Polls/watches blockchain   │
                     │               │    Writes to Supabase         │
              ┌──────▼─────────┐     └────────────────────────────┘
              │  Ethereum       │              ▲
              │  Blockchain     │              │ eth_getLogs / watchEvents
              │                │              │
              │  ┌───────────┐ │     ┌────────┴──────────────────┐
              │  │ CoinFlip  ├─┼────►│   Blockchain Events        │
              │  │ Contract  │ │     │   - GameCreated            │
              │  │ (Solidity)│ │     │   - GameJoined             │
              │  └─────┬─────┘ │     │   - GameResolved           │
              │        │        │     │   - GameCancelled          │
              │  ┌─────▼─────┐ │     └───────────────────────────┘
              │  │ Chainlink │ │
              │  │ VRF V2.5  │ │
              │  │ (Random)  │ │
              │  └─────────┘ │
              │               │
              │  ┌──────────┐ │
              │  │Chainlink  │ │
              │  │Automation│ │
              │  │(AutoCancel│ │
              └──┴──────────┴─┘
```

### Game Lifecycle Flowchart

```
Player A                    Blockchain                  Chainlink           Player B
   │                            │                          │                   │
   │── createGame(tier,choice) ─►│                          │                   │
   │   [sends ETH]               │                          │                   │
   │◄── GameCreated event ───────│                          │                   │
   │                            │                          │                   │
   │    [Indexer picks up]       │◄── EventLog ─────────────────────────────────│
   │                            │                          │                   │
   │ ◄── Supabase INSERT ──────────────────────────────────────────────────── │
   │   [Game shows in queue]     │                          │                   │
   │                            │                          │     joinGame(id) ─►│
   │                            │◄── [sends ETH] ──────────────────────────── │
   │                            │                          │                   │
   │                            │── requestRandomWords() ──►│                   │
   │                            │◄── requestId ────────────│                   │
   │◄── GameJoined event ───────│                          │                   │
   │                            │    [Indexer updates]     │                   │
   │◄── Supabase UPDATE (matched) ────────────────────────────────────────────►│
   │   [WebSocket: matched]      │                          │                   │
   │                            │    [VRF processing ~10-30s]                  │
   │                            │◄── fulfillRandomWords() ─│                   │
   │                            │    [coinResult = random % 2]                 │
   │                            │── transfer(payout) ──────────────────────── ►│ (if winner)
   │                            │◄── transfer(payout) ─────────────────────── │ (if winner A)
   │◄── GameResolved event ─────│                          │                   │
   │                            │    [Indexer updates]     │                   │
   │◄── Supabase UPDATE (resolved) ──────────────────────────────────────────►│
   │   [WebSocket: result]       │                          │                   │
   │   [Coin animation + modal]  │                          │   [Coin animation]│
   │                            │                          │                   │

Timeout Path (no opponent joins):
   │
   │   [After timeoutBlocks (~5 min)]
   │                            │◄── Chainlink Automation (checkUpkeep/performUpkeep)
   │                            │── cancelGame() internal
   │                            │── refund(playerA)
   │◄── GameAutoCancelled event─│
   │   [OR creator cancels manually]
   │── cancelGame(id) ──────────►│
   │◄── GameCancelled event ────│
   │   [Full refund]            │

VRF Failure Path:
   │                            │   [After vrfTimeoutBlocks (~40 min)]
   │── claimVrfTimeout(id) ─────►│
   │                            │── refund(playerA) + refund(playerB)
   │◄── VrfTimeoutClaimed event ─│
```

---

## Smart Contract Architecture

### Contract: `CoinFlip.sol` (V4, 1177 lines)

**Inheritance Chain:**
```
CoinFlip
  ├── ReentrancyGuard (OpenZeppelin)
  ├── Pausable (OpenZeppelin)
  ├── Ownable (OpenZeppelin)
  └── AutomationCompatibleInterface (Chainlink)
```

**State Machine:**
```
          createGame()
NONE ──────────────────► OPEN
                          │ │
            cancelGame()  │ │ joinGame()
                          │ │
                     CANCELLED ◄─ cancelGame() / performUpkeep()
                               ◄─ claimVrfTimeout()
                               ◄─ emergencyRefund() [admin, paused only]
                          │
                        LOCKED
                          │
            fulfillRandomWords() [VRF Coordinator only]
                          │
                       RESOLVED
```

**Key Constants:**
| Constant | Value | Notes |
|---|---|---|
| MAX_TIERS | 10 | Tier IDs 0–9 |
| MAX_FEE_BASIS_POINTS | 1000 | 10% cap |
| MIN_TIMEOUT_BLOCKS | 10 | ~2 min Sepolia |
| MAX_TIMEOUT_BLOCKS | 1000 | ~3.3 hr Sepolia |
| MAX_OPEN_GAMES | 1000 | Prevents unbounded array |
| VRF_CALLBACK_GAS_LIMIT | 100,000 | Gas for fulfillRandomWords |
| VRF_REQUEST_CONFIRMATIONS | 3 | Block confirmations before VRF |
| MAX_BATCH_CANCEL | 10 | Games cancelled per Automation upkeep |

**Configurable Parameters (owner-adjustable):**
| Parameter | Default | Range |
|---|---|---|
| feeBasisPoints | 300 (3%) | 0–1000 (0–10%) |
| timeoutBlocks | 25 (~5 min) | 10–1000 |
| vrfTimeoutBlocks | 200 (~40 min) | 4×timeout–10,000 |
| maxGamesPerPlayer | 5 | 1–20 |

---

## Frontend Architecture

### Page → Hook → Data Flow

```
app/play/page.tsx
  └── useCreateGame()           [hooks/useContract.ts]
        └── walletClient.sendTransaction()
  └── usePendingTransactions()  [hooks/usePendingTransactions.ts]
        └── supabase.from('pending_transactions')
  └── useCreatedGameTracking()  [hooks/useCreatedGameTracking.ts]
        └── polls supabase for tx_hash match
  └── useUserPreferences()      [hooks/useUserPreferences.ts]
        └── supabase.from('user_preferences')

app/queue/page.tsx
  └── usePendingGames()         [hooks/useGames.ts]
        └── queryPendingGames() [lib/queries/games.ts]
              └── supabase.from('games').eq('status','pending')
  └── useJoinGame()             [hooks/useContract.ts]
  └── useRealtimeStats()        [hooks/useRealtimeStats.ts]
        └── supabase.from('pending_games_by_tier') [view]

app/dashboard/page.tsx
  └── useUserActiveGames()      [hooks/useGames.ts]
  └── usePlayerGames()          [hooks/useGames.ts]
  └── useCancelGame()           [hooks/useContract.ts]
```

### State Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Zustand Store                        │
│  selectedTier: number | null                              │
│  coinChoice: boolean | null                               │
│  activeGames: Map<id, {game, addedAt}>                    │
│  modalQueue: ModalQueueEntry[]    (FIFO for results)      │
│  showGameModal: boolean                                    │
│  currentGameId: string | null                              │
│  addActiveGame() / removeActiveGame()                      │
│  enqueueModal() / dequeueModal()                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   TanStack Query Cache                    │
│  games.all          → [Game[]]          stale: 60s        │
│  games.pending      → [Game[]]          stale: 15s        │
│  games.active       → [Game[]]          stale: 15s        │
│  games.player(addr) → [Game[]]          stale: 30s        │
│  games.userActive   → [Game[]]          stale: 5s         │
│  games.byId(id)     → Game             stale: 60s         │
│  stats.game         → GameStats        stale: 30s         │
│  stats.player(addr) → PlayerStats      stale: 60s         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                  DataContext (React Context)               │
│  mode: 'blockchain' | 'supabase'                          │
│  isLoggedIn: boolean                                       │
│  features: { realtime, preferences, stats, history }      │
└──────────────────────────────────────────────────────────┘
```

---

## Backend & API

### RPC Proxy (`/api/rpc`)

**Purpose:** Hide API keys, add rate limiting + caching between browser and Alchemy/public RPC.

**Security Layers:**
1. Rate limit: 100 req/min/IP (Redis or in-memory fallback)
2. Payload size: 10KB max
3. JSON-RPC validation: must be 2.0, valid method + id
4. Method allowlist: 21 methods only (no `admin_`, `debug_`, `personal_`)
5. Chain ID whitelist: Sepolia, Polygon Amoy, Polygon Mainnet
6. Security response headers on all responses

**Caching:**
| Method | TTL |
|---|---|
| eth_chainId | 1 hour |
| eth_blockNumber | 6 seconds |
| eth_gasPrice | 15 seconds |
| eth_maxPriorityFeePerGas | 15 seconds |
| net_version | 1 hour |

**Never cached:** eth_sendRawTransaction, eth_getTransactionCount, eth_getBalance, eth_call, eth_estimateGas, eth_getLogs

### Event Indexer (daemon: `scripts/event-indexer.ts`)

**Role:** Bridge between blockchain and database. Listens for contract events and writes to Supabase.

**Events handled:**
- `GameCreated` → INSERT into games (status: pending)
- `GameJoined` → UPDATE games (status: matched, joiner data)
- `GameResolved` → UPDATE games (status: resolved, winner, payout)
- `GameCancelled / GameAutoCancelled` → UPDATE games (status: cancelled)

**Transport:** WebSocket (preferred) → HTTP polling fallback
**Retry:** 3 retries with exponential backoff per operation
**State:** Tracks `last_processed_block` in `indexer_state` table

---

## Database Schema

### Core Tables

```sql
games
  id               BIGINT PK
  tx_hash          TEXT                    -- GameCreated tx
  matched_tx_hash  TEXT                    -- GameJoined tx
  resolved_tx_hash TEXT                   -- GameResolved tx
  cancelled_tx_hash TEXT                  -- GameCancelled tx
  tier             INTEGER (0–9)
  amount           TEXT                    -- wei as string
  payout           TEXT                    -- wei as string (after fee)
  fee              TEXT                    -- wei as string
  creator_address  TEXT                    -- lowercase hex
  joiner_address   TEXT
  winner_address   TEXT
  creator_choice   BOOLEAN                 -- false=heads, true=tails
  joiner_choice    BOOLEAN
  coin_result      BOOLEAN
  status           TEXT                    -- pending|matched|resolved|cancelled
  block_number     BIGINT
  created_at       TIMESTAMPTZ
  matched_at       TIMESTAMPTZ
  resolved_at      TIMESTAMPTZ
  cancelled_at     TIMESTAMPTZ

pending_transactions
  id               BIGSERIAL PK
  user_address     TEXT
  tx_type          TEXT                    -- create|join|cancel
  tx_hash          TEXT
  game_id          BIGINT FK→games.id
  tier, choice, amount_eth                -- create context
  status           TEXT                    -- pending|submitted|confirmed|failed|expired
  UNIQUE (user_address, tx_type, game_id) WHERE status IN ('pending','submitted')
  -- auto-expire after 10 min, auto-delete after 24h

user_preferences
  user_address     TEXT
  skip_animation   BOOLEAN
  sound_enabled    BOOLEAN
  default_tier     INTEGER
  last_game_tier, last_game_choice, last_game_was_win

user_game_notifications
  user_address     TEXT
  game_id          TEXT
  matched_modal_shown, resolved_modal_shown    -- dedup across devices
  matched_sound_played, resolved_sound_played

activity_feed
  event_type       TEXT                    -- game_created|game_matched|game_resolved|big_win
  game_id          BIGINT
  player_address, opponent_address, tier, amount, payout

tiers                                      -- mirrors contract tier config
  id               INTEGER (0–9)
  amount           TEXT (wei)
  amount_usd       NUMERIC
  enabled          BOOLEAN

contract_config                            -- mirrors contract admin params
  id               TEXT ('current')
  contract_address TEXT
  fee_basis_points INTEGER
  timeout_blocks   INTEGER
  tier_amounts     JSONB

indexer_state                              -- indexer progress tracking
  indexer_name     TEXT
  last_processed_block TEXT               -- stored as string (big numbers)
```

### Key Views
- `active_games` — pending + matched games with tier data
- `pending_games_by_tier` — queue counts per tier (used by queue page)
- `game_statistics` — global platform stats
- `player_stats_view` — aggregated stats per player

### Triggers
- `cleanup_expired_pending_transactions()` — cron, expires pending TXs >10 min
- `resolve_pending_on_game_create()` — marks pending create as confirmed
- `resolve_pending_on_game_update()` — marks pending ops as confirmed on game state change

---

## Data Flow Diagrams

### Create Game Flow

```
[User clicks "Create Game"]
        │
        ▼
useCreateGame() — validates tier/amount, checks rate limit
        │
        ▼
walletClient.sendTransaction() — user signs in wallet
        │
        ▼ (async, non-blocking)
usePendingTransactions.addPendingTransaction() — writes to DB immediately
        │
        ▼ (parallel)
useWaitForTransactionReceipt() ─────────────────────────────────────┐
useCreatedGameTracking() — polls DB for tx_hash match                │
        │                                                            │
        ▼ (receipt confirmed)                                        │
setTxHash() — updates pending_tx in DB                              │
        │                                                            │
        ▼ (indexer processes GameCreated event)                     │
game appears in Supabase games table                 ◄──────────────┘
        │
        ▼
useCreatedGameTracking.onGameFound() — game is now visible
        │
        ▼
Supabase Realtime broadcasts UPDATE to channel `game:{id}`
        │
        ▼
useGameSync handles update — shows "Waiting for opponent" UI
```

### Join + VRF Flow

```
[Player B clicks "Join Game"]
        │
        ▼
useJoinGame() — validates gameId/amount, rate limit check
        │
        ▼
walletClient.sendTransaction()
        │
        ▼ (on-chain)
contract.joinGame(gameId) {
  game.state = LOCKED
  _removeFromOpenGames(gameId)
  requestRandomWords() → Chainlink VRF
  emit GameJoined
}
        │
        ▼ (indexer)
UPDATE games SET status='matched', joiner_address=...
        │
        ▼ (WebSocket)
Both players receive Realtime UPDATE
        │
        ▼ (~10-30 seconds)
Chainlink VRF calls fulfillRandomWords() {
  coinResult = randomWords[0] % 2
  winner = coinResult == choiceA ? playerA : playerB
  game.state = RESOLVED
  transfer(payout) to winner
  emit GameResolved
}
        │
        ▼ (indexer)
UPDATE games SET status='resolved', winner_address=..., coin_result=...
        │
        ▼ (WebSocket)
Both players receive final UPDATE
useGameSync triggers coin animation → result modal
```

---

## External Services

| Service | Purpose | Failure Mode |
|---|---|---|
| Alchemy (RPC) | Ethereum RPC via proxy | Falls back to public RPC |
| Chainlink VRF V2.5 | Provably fair randomness | vrfTimeoutBlocks refund escape hatch |
| Chainlink Automation | Auto-cancel expired games | Manual cancel still available |
| Supabase DB | Game indexing + user data | Blockchain mode (read-only, no history) |
| Supabase Realtime | WebSocket game updates | Polling fallback |
| Supabase Auth | Email/password + OAuth | Wallet-only mode still works |
| Sentry | Error tracking | Graceful no-op |
| WalletConnect | Multi-wallet support | MetaMask direct connection still works |
| Upstash Redis | Distributed rate limiting | In-memory fallback |

---

## Security Model

### Layers of Defense

```
[User] → [Browser CSP] → [Next.js Middleware: headers + rate limit + origin check]
       → [/api/rpc: method allowlist + rate limit + size limit]
       → [Supabase RLS: row-level policies]
       → [Smart Contract: ReentrancyGuard + Pausable + Ownable + CEI pattern]
       → [Chainlink VRF: tamper-proof randomness]
```

### Trust Boundaries
- **Fully trusted:** Smart contract, Chainlink VRF Coordinator
- **Trusted for data integrity:** Supabase (centralized DB — game state always verifiable on-chain)
- **Untrusted:** All user inputs, RPC responses (validated before use)
- **Semi-trusted:** Indexer (writes to DB, uses service role key)

---

## Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel CDN    │    │  Supabase Cloud  │    │   VPS / Lambda  │
│                 │    │                 │    │                 │
│  Next.js App    │    │  PostgreSQL DB   │    │  Event Indexer  │
│  (standalone)   │◄──►│  Realtime WS    │◄───│  (Node daemon)  │
│  Edge Functions │    │  Auth + Storage  │    │                 │
└────────┬────────┘    └─────────────────┘    └────────┬────────┘
         │                                             │
         ▼                                             ▼
┌─────────────────┐                         ┌─────────────────┐
│  Alchemy RPC    │                         │  Sepolia / Poly │
│  (Ethereum)     │◄────────────────────────│  gon Mainnet    │
└─────────────────┘                         └─────────────────┘
```

**Production Targets:**
- Frontend: Vercel (`vercel.json` configured)
- DB: Supabase Cloud (36 migrations)
- Chain: Polygon Mainnet (137) for production
- Indexer: systemd service or PM2 on VPS

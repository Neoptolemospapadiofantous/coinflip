# CoinFlip — Optimization & Refactoring Plan

> Date: 2026-05-03 | Status: Proposed

This document covers all optimization, refactoring, and quality improvements identified across the codebase. It is separate from the security audit (see `SECURITY_AUDIT.md`). Each item includes rationale, scope, and estimated effort.

---

## Table of Contents

1. [Smart Contract Optimizations](#smart-contract-optimizations)
2. [Frontend Optimizations](#frontend-optimizations)
3. [Backend / API Optimizations](#backend--api-optimizations)
4. [Database Optimizations](#database-optimizations)
5. [Indexer Optimizations](#indexer-optimizations)
6. [DevOps / Infrastructure](#devops--infrastructure)
7. [Code Quality & Refactoring](#code-quality--refactoring)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Smart Contract Optimizations

### OPT-C1 — Implement Pull Payment Pattern

**Impact:** Security (CRITICAL) + correctness
**Effort:** Medium (2–3 days including tests)

Replace push payments with a `withdrawable` mapping and `withdraw()` function. Affects `claimVrfTimeout`, `emergencyRefund`, and potentially `performUpkeep`.

Benefits:
- Eliminates DoS via malicious contract wallets
- Simplifies refund logic — no sequential transfer failures
- Gas savings per transaction (no silent failure handling)

```solidity
mapping(address => uint256) public withdrawable;

function withdraw() external nonReentrant {
    uint256 amount = withdrawable[msg.sender];
    if (amount == 0) revert NoFundsToWithdraw();
    withdrawable[msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();
    emit Withdrawn(msg.sender, amount);
}
```

The winner payout in `fulfillRandomWords` should remain push (immediate delivery to EOA winner is expected and desired — a reverting winner would lose their own funds, which is their problem).

---

### OPT-C2 — Increase VRF Callback Gas Limit

**Impact:** Reliability
**Effort:** Low (30 min)

Change `VRF_CALLBACK_GAS_LIMIT` from 100,000 to 200,000 (or make it `public` and configurable via `setVrfCallbackGasLimit()`). This prevents VRF callbacks from reverting under high gas conditions.

---

### OPT-C3 — Add Automation Forwarder Access Control

**Impact:** Security + correctness
**Effort:** Low (2 hours)

```solidity
address public automationForwarder;

modifier onlyForwarder() {
    if (msg.sender != automationForwarder && msg.sender != owner()) {
        revert NotAuthorized();
    }
    _;
}
```

Set the forwarder address during Chainlink Automation registration.

---

### OPT-C4 — Optimize `checkUpkeep` for Large Arrays

**Impact:** Gas efficiency at scale
**Effort:** Medium (1 day)

Track the last index scanned across calls using a cursor:
```solidity
uint256 public checkUpkeepCursor;

// In checkUpkeep, start from cursor and wrap around
```

Or: maintain games sorted by expiry using a min-heap approach.

---

### OPT-C5 — Fix Error Messages

**Impact:** Developer experience, debuggability
**Effort:** Low (1 hour)

Add dedicated errors:
```solidity
error NotVrfCoordinator();
error InvalidCoordinator();
error NoFundsToWithdraw();
error NotAuthorized();
```

Replace reused errors in `rawFulfillRandomWords` (line 1056) and constructor (line 319).

---

### OPT-C6 — Add Timelock for Admin Parameter Changes

**Impact:** Trust + decentralization
**Effort:** High (3–5 days including deployment)

Use OpenZeppelin `TimelockController` as the contract owner with 24-48h delay. Keep `pause()` immediate (emergency-only).

This is essential before any significant TVL on mainnet.

---

### OPT-C7 — Pack Struct Fields for Gas Savings

**Impact:** Gas optimization
**Effort:** Low (2 hours)

```solidity
// Current Game struct uses ~6 storage slots
// Reordering address + uint8/bool fields saves 1-2 slots:
struct Game {
    address playerA;        // slot 0 (20 bytes)
    uint8 tier;             // slot 0 (1 byte, packed with address)
    bool choiceA;           // slot 0 (1 byte)
    GameState state;        // slot 0 (1 byte, enum)
    address playerB;        // slot 1 (20 bytes)
    bool coinResult;        // slot 1 (1 byte)
    address winner;         // slot 2 (20 bytes)
    uint256 createdBlock;   // slot 3
    uint256 lockedBlock;    // slot 4
    uint256 vrfRequestId;   // slot 5
}
```

This reduces SLOAD/SSTORE costs for frequently accessed game data.

---

## Frontend Optimizations

### OPT-F1 — Fix VRF Timeout Constant Mismatch

**Impact:** UX correctness
**Effort:** Low (30 min)

**File:** `lib/constants.ts:39`

```typescript
// Current (wrong): 120 seconds
export const VRF_TIMEOUT_SECONDS = 120;

// Fix: derive from contract's vrfTimeoutBlocks
export const VRF_TIMEOUT_SECONDS = VRF_TIMEOUT_BLOCKS * AVG_BLOCK_TIME_SECONDS;
// = 200 * 12 = 2400 seconds (40 minutes)
```

Update all UI that displays "VRF timeout" countdown.

---

### OPT-F2 — Reduce Polling Frequency

**Impact:** Performance, RPC cost reduction
**Effort:** Low (2 hours)

Several hooks poll too aggressively:

| Hook / Location | Current | Recommended |
|---|---|---|
| `useGameData` refetchInterval | 5s | 12s (one block) |
| `useCanClaimVrfTimeout` | 10s | 30s |
| `useCanCancelGame` | 10s | 30s |
| `DEFAULT_REFETCH_INTERVAL_MS` | 5s | 10–12s |

Real-time updates via Supabase WebSocket make most polling unnecessary. Reserve polling for contract state reads.

---

### OPT-F3 — Consolidate Duplicate Game Normalization

**Impact:** Code quality, maintainability
**Effort:** Low (1 hour)

`normalizeGames()` exists in both `hooks/useGames.ts` and `lib/data/supabase-source.ts` with identical implementations. Extract to a shared utility:

```typescript
// lib/utils/game.ts
export function normalizeGames(data: unknown[] | null): Game[] { ... }
```

---

### OPT-F4 — Memoize Expensive Computations

**Impact:** Render performance
**Effort:** Low (2 hours)

Several components re-compute derived values on every render:
- USD conversion in `TierSelector` — memoize with `useMemo`
- Sorted/filtered game lists — memoize sort operations
- Active game count calculation — derive from Zustand store with `useMemo`

---

### OPT-F5 — Lazy Load Non-Critical Pages

**Impact:** Initial bundle size, LCP
**Effort:** Low (2 hours)

Pages like Leaderboard, History, and Settings are not on the critical path. Use Next.js dynamic imports:

```typescript
const LeaderboardPage = dynamic(() => import('./LeaderboardContent'), {
  loading: () => <LoadingSkeleton />,
});
```

---

### OPT-F6 — Improve Error Boundary Granularity

**Impact:** Resilience, UX
**Effort:** Medium (1 day)

Current: One global `ErrorBoundary` at the app root.
Improvement: Add section-level error boundaries around:
- `ActiveGamesPanel` — game errors shouldn't crash the whole play page
- `ActivityFeed` — feed errors shouldn't affect game creation
- `StatsCards` — stats errors shouldn't break the dashboard

---

### OPT-F7 — Add Loading Skeletons

**Impact:** Perceived performance
**Effort:** Medium (1 day)

Replace blank areas during data loading with skeleton loaders for:
- Game queue list
- Dashboard stats cards
- Leaderboard table rows

---

### OPT-F8 — Optimize Realtime Subscription Management

**Impact:** Memory leaks, connection stability
**Effort:** Medium (1 day)

**File:** `lib/realtime/registry.ts`

Verify all WebSocket channels are properly unsubscribed when:
- User navigates away from a game
- Game reaches a terminal state (resolved/cancelled)
- Component unmounts mid-subscription

Add explicit cleanup audit to prevent memory leaks over long sessions.

---

### OPT-F9 — Type Safety for Game IDs

**Impact:** Bug prevention
**Effort:** Low (2 hours)

Game IDs are used as `string`, `number`, `bigint`, and `string | number | bigint` interchangeably across the codebase. Create a branded type:

```typescript
type GameId = string & { readonly _brand: 'GameId' };
function toGameId(id: string | number | bigint): GameId { ... }
```

---

## Backend / API Optimizations

### OPT-B1 — Move RPC Cache to Redis

**Impact:** Cache hit rates in serverless
**Effort:** Medium (half day)

The in-memory LRU cache in `/api/rpc/route.ts` doesn't persist across Vercel function invocations. Move to Upstash Redis (same infrastructure as rate limiter) with the same TTLs.

```typescript
// Use existing redis instance from getApiRateLimiter
const cache = Redis.fromEnv();
await cache.set(key, JSON.stringify(response), { ex: ttlSeconds });
const cached = await cache.get(key);
```

---

### OPT-B2 — Remove Duplicate Rate Limiter in Middleware

**Impact:** Code simplification
**Effort:** Low (30 min)

**File:** `middleware.ts:107–131`

The middleware has its own in-memory rate limiter AND the `/api/rpc` route has a proper distributed rate limiter. The middleware one is:
1. Less secure (in-memory, per-instance)
2. Redundant (the route has a better one)

Remove the middleware rate limiter for `/api/rpc` and rely on the route-level one.

---

### OPT-B3 — Add Batch RPC Support

**Impact:** Performance (reduces round trips)
**Effort:** Medium (1 day)

The RPC proxy only handles single JSON-RPC requests. wagmi/viem can batch requests, but the proxy rejects arrays. Add batch request support:

```typescript
// Handle both single and batch requests
if (Array.isArray(body)) {
  // Process batch, validate each, forward as batch
}
```

---

### OPT-B4 — Add Request Tracing

**Impact:** Debugging, observability
**Effort:** Low (2 hours)

Add correlation IDs to all RPC proxy requests for easier log tracing:

```typescript
const requestId = generateSecureToken(8);
response.headers.set('X-Request-Id', requestId);
// Log with requestId for all operations
```

---

## Database Optimizations

### OPT-D1 — Add Missing Composite Indexes

**Impact:** Query performance
**Effort:** Low (half day — new migration)

Queries that likely do full-table scans:
```sql
-- For "active games by player" queries:
CREATE INDEX CONCURRENTLY idx_games_active_player
  ON games (creator_address, status)
  WHERE status IN ('pending', 'matched');

-- For "games by joiner":
CREATE INDEX CONCURRENTLY idx_games_joiner_status
  ON games (joiner_address, status);

-- For history pagination:
CREATE INDEX CONCURRENTLY idx_games_created_at_desc
  ON games (created_at DESC)
  WHERE status IN ('resolved', 'cancelled');
```

---

### OPT-D2 — Partition `games` Table by Status

**Impact:** Long-term query performance as table grows
**Effort:** High (requires migration + indexer changes)

As the games table grows to millions of rows, queries against active games will slow down. Partition by status to keep hot data in a small partition:
- `games_active` (pending, matched)
- `games_historical` (resolved, cancelled)

Or use a separate `resolved_games` archive table with periodic batch moves.

---

### OPT-D3 — Optimize `pending_games_by_tier` View

**Impact:** Queue page load time
**Effort:** Low (1 hour — update migration)

The view is used every time the queue page loads and every time realtime stats refresh. Ensure it uses the correct index and does not do a full table scan:

```sql
-- Verify this uses idx_games_pending_tier
EXPLAIN ANALYZE SELECT * FROM pending_games_by_tier;
```

Consider materializing this view with a trigger-based refresh for the highest-traffic deployments.

---

### OPT-D4 — Add `updated_at` Timestamp to All Tables

**Impact:** Cache invalidation, debugging
**Effort:** Low (migration)

Tables missing `updated_at` (auto-updated trigger):
- `tiers`
- `contract_config`
- `activity_feed`

---

## Indexer Optimizations

### OPT-I1 — Add Redundancy / Health Monitoring

**Impact:** Reliability (HIGH)
**Effort:** Medium (1 day)

1. Add a `/health` endpoint to the indexer (HTTP server on port 3001)
2. Report: last processed block, lag behind chain head, events processed per minute
3. Alert via Sentry if lag exceeds N blocks
4. Run a second passive indexer that can take over if primary fails

---

### OPT-I2 — Add Checkpoint Persistence

**Impact:** Crash recovery speed
**Effort:** Low (2 hours)

Currently, `last_processed_block` is stored in Supabase. If the DB is unavailable when the indexer starts, it can't determine where to resume. Add a local fallback checkpoint file as backup.

---

### OPT-I3 — Improve Event Processing Concurrency

**Impact:** Indexer throughput during catch-up
**Effort:** Medium (half day)

During initial sync (catching up from block 0 or after downtime), process events in parallel batches rather than sequentially:

```typescript
// Instead of:
for (const event of events) { await processEvent(event); }

// Do:
const batches = chunk(events, 10);
for (const batch of batches) {
    await Promise.all(batch.map(processEvent));
}
```

---

### OPT-I4 — Add Multi-Chain Support

**Impact:** Feature completeness
**Effort:** High (2–3 days)

The indexer is hardcoded to Sepolia. For Polygon mainnet deployment, refactor to support multiple chains simultaneously:

```typescript
const chains = [
  { id: 137, rpc: POLYGON_RPC, contract: POLYGON_CONTRACT },
  { id: 11155111, rpc: SEPOLIA_RPC, contract: SEPOLIA_CONTRACT },
];
```

---

## DevOps / Infrastructure

### OPT-D1 — Add CI/CD Pipeline

**Impact:** Release safety
**Effort:** Medium (1 day)

Add GitHub Actions workflows:
- `lint.yml` — ESLint + TypeScript check on every PR
- `test.yml` — Vitest unit tests + Hardhat contract tests
- `security.yml` — Run `scripts/security-audit.ts` on every PR
- `deploy.yml` — Auto-deploy to Vercel on merge to master

---

### OPT-D2 — Contract Audit Before Mainnet

**Impact:** Security assurance
**Effort:** External (1–2 months timeline)

Commission a professional smart contract security audit from a reputable firm (Trail of Bits, Sherlock, Code4rena contest, etc.) before deploying to mainnet with real funds.

---

### OPT-D3 — Environment Variable Validation at Startup

**Impact:** Operational reliability
**Effort:** Low (2 hours)

**File:** `lib/env.ts`

Validate ALL required environment variables at startup with clear error messages. Currently some are validated, but missing vars can cause cryptic runtime errors rather than startup failures.

---

### OPT-D4 — Add Monitoring Dashboard

**Impact:** Operational visibility
**Effort:** Medium (1 day)

Key metrics to monitor:
- Games created / resolved / cancelled per hour
- Average time to match per tier
- VRF resolution time distribution
- Failed refund count (stuck funds)
- Indexer lag (blocks behind chain head)
- RPC proxy cache hit rate

Use Grafana + Supabase metrics or a service like Datadog/New Relic.

---

## Code Quality & Refactoring

### OPT-Q1 — Unify Data Source Interface Usage

**Impact:** Maintainability
**Effort:** Medium (1 day)

The `DataProvider` switches between `blockchain.ts` and `supabase-source.ts` based on login state, but many hooks directly import from `lib/queries` without going through the provider. This creates inconsistency.

**Fix:** All data fetching should flow through a single `useDataSource()` hook that abstracts the provider, so switching between blockchain/Supabase mode is transparent.

---

### OPT-Q2 — Extract Game State Machine

**Impact:** Code clarity, testability
**Effort:** Medium (1 day)

Game state transitions are spread across multiple hooks and components. Extract a `useGameStateMachine(gameId)` hook that:
- Owns the state transition logic
- Exposes typed state + allowed transitions
- Can be unit tested independently

---

### OPT-Q3 — Remove Dead Code

**Impact:** Bundle size, clarity
**Effort:** Low (2 hours)

- `lib/mockData.ts` — used in dev only, tree-shake or remove
- `scripts/reset-indexer-state.ts` — document when this should be used
- Check for unused exports in `lib/realtime/registry.ts`

---

### OPT-Q4 — Standardize Error Handling

**Impact:** User experience consistency
**Effort:** Medium (1 day)

Error display is inconsistent — some hooks return error objects, some throw, some set state. Create a standard:
1. Hooks return `{ data, error, isLoading }` (React Query pattern)
2. Errors are classified: `UserError`, `ContractError`, `NetworkError`
3. Each error class has a user-friendly message

---

### OPT-Q5 — Add E2E Tests

**Impact:** Release confidence
**Effort:** High (3–5 days)

Add Playwright tests for critical paths:
- Create game → join game → view result
- Cancel game (immediate and after timeout)
- VRF timeout claim flow
- Wallet connection + disconnection

---

## Implementation Roadmap

### Phase 1 — Pre-Mainnet (MUST DO)

These must be completed before deploying with real money:

| # | Task | Effort | Priority |
|---|---|---|---|
| 1 | S1: Implement pull-payment pattern | 2–3 days | P0 |
| 2 | S2: Add forwarder access control to performUpkeep | 2 hours | P0 |
| 3 | S3/S4: Fix emergencyRefund stuck fund tracking | 1 day | P0 |
| 4 | OPT-C2: Increase VRF callback gas limit | 30 min | P0 |
| 5 | OPT-C5: Fix misleading errors | 1 hour | P0 |
| 6 | OPT-F1: Fix VRF timeout constant mismatch | 30 min | P0 |
| 7 | S6: Indexer health monitoring + redundancy | 1 day | P0 |
| 8 | S16: Fix VRF timeout UI display | 30 min | P0 |
| 9 | Professional contract audit | External | P0 |
| 10 | S17: Deploy behind Gnosis Safe multisig | 1 day | P0 |

### Phase 2 — Launch (should do at launch)

| # | Task | Effort |
|---|---|---|
| 11 | S9: Investigate removing unsafe-eval from CSP | 1 day |
| 12 | OPT-B1: Move RPC cache to Redis | half day |
| 13 | OPT-B2: Remove duplicate middleware rate limiter | 30 min |
| 14 | OPT-D1: Add composite DB indexes | half day |
| 15 | OPT-D1: Add CI/CD pipeline | 1 day |
| 16 | OPT-C6: Add timelock for admin functions | 3–5 days |
| 17 | OPT-F2: Reduce polling frequency | 2 hours |
| 18 | OPT-I1: Indexer health endpoint + alerting | 1 day |

### Phase 3 — Post-Launch (quality improvements)

| # | Task | Effort |
|---|---|---|
| 19 | OPT-C4: Optimize checkUpkeep for large arrays | 1 day |
| 20 | OPT-C7: Pack Game struct fields | 2 hours |
| 21 | OPT-F3: Consolidate duplicate normalizeGames | 1 hour |
| 22 | OPT-F5: Lazy load non-critical pages | 2 hours |
| 23 | OPT-F7: Add loading skeletons | 1 day |
| 24 | OPT-I3: Improve indexer concurrency | half day |
| 25 | OPT-I4: Multi-chain indexer support | 2–3 days |
| 26 | OPT-Q4: Standardize error handling | 1 day |
| 27 | OPT-Q5: Add E2E tests | 3–5 days |
| 28 | OPT-D4: Monitoring dashboard | 1 day |

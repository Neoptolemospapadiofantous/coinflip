# CoinFlip — Security Audit & Risk Assessment

> Date: 2026-05-03 | Contract V4 | Severity: CRITICAL / HIGH / MEDIUM / LOW

This is a comprehensive security review covering the smart contract, backend, frontend, and infrastructure layers. Issues are ordered by severity within each category.

---

## Summary Table

| # | Severity | Layer | Issue |
|---|---|---|---|
| S1 | CRITICAL | Contract | Pull-payment missing in `claimVrfTimeout` (DoS via griefing) |
| S2 | CRITICAL | Contract | `performUpkeep` has no access control |
| S3 | HIGH | Contract | `emergencyRefund` stuck funds not tracked |
| S4 | HIGH | Contract | `recoverStuckFunds` always sends to `playerA` |
| S5 | HIGH | Contract | VRF callback gas limit may be insufficient at scale |
| S6 | HIGH | Infra | Indexer is single point of failure with no redundancy |
| S7 | MEDIUM | Contract | Misleading error in `rawFulfillRandomWords` |
| S8 | MEDIUM | Contract | VRF coordinator address zero-check reuses wrong error |
| S9 | MEDIUM | Frontend | CSP uses `unsafe-eval` in production |
| S10 | MEDIUM | Backend | Middleware rate limiter is in-memory (not distributed) |
| S11 | MEDIUM | Contract | `openGameIds` array O(n) scan in `checkUpkeep` |
| S12 | MEDIUM | Frontend | Client-side rate limiting is trivially bypassable |
| S13 | LOW | Backend | RPC proxy caches with in-memory Map (no cross-instance sharing) |
| S14 | LOW | Contract | No timelocked admin functions (instant parameter changes) |
| S15 | LOW | Infra | Service role key in `.env.local` (rotation risk) |
| S16 | LOW | Frontend | VRF timeout UI (120s) doesn't match contract (200 blocks ≈ 40 min) |
| S17 | INFO | Contract | `Ownable` single-owner — no multi-sig |
| S18 | INFO | DB | `stuckFunds` gameId→playerA mapping: no support for playerB stuck funds |

---

## CRITICAL Issues

### S1 — Pull-Payment Missing in `claimVrfTimeout` (DoS Risk)

**File:** `contracts/CoinFlip.sol:528–534`

**Problem:** `claimVrfTimeout` sends ETH to both players sequentially using low-level `.call`. If `playerA`'s refund succeeds but `playerB`'s fails (e.g., `playerB` is a malicious contract with a reverting fallback), the entire transaction reverts. This leaves `playerA` unable to recover their funds.

```solidity
// VULNERABLE
(bool successA, ) = game.playerA.call{value: refundAmount}("");
if (!successA) revert TransferFailed();  // ← revert here traps playerB's refund too

(bool successB, ) = game.playerB.call{value: refundAmount}("");
if (!successB) revert TransferFailed();
```

**Impact:** PlayerB can grief the VRF timeout claim by deploying a contract wallet with a reverting receive(). PlayerA's funds are permanently locked until admin uses emergencyRefund.

**Fix:** Use the pull-payment pattern — store claimable amounts and let each player withdraw independently.

```solidity
// In claimVrfTimeout:
game.state = GameState.CANCELLED;
withdrawable[game.playerA] += refundAmount;
withdrawable[game.playerB] += refundAmount;

// Add withdraw function:
function withdraw() external nonReentrant {
    uint256 amount = withdrawable[msg.sender];
    if (amount == 0) revert NoFundsToWithdraw();
    withdrawable[msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();
}
```

---

### S2 — `performUpkeep` Has No Access Control

**File:** `contracts/CoinFlip.sol:820`

**Problem:** `performUpkeep` is `external` with no `onlyAutomation` guard. Anyone can call it with arbitrary `performData`. An attacker can call it with a list of valid but unexpired game IDs and have them cancelled early (since the re-validation check `block.number >= game.createdBlock + timeoutBlocks` protects against premature cancellation — but only if the array contains valid game IDs in OPEN state past timeout).

However, the attacker can also spam call it to drain gas from the Chainlink Automation subscription or cause race conditions in the state machine.

**Current mitigation:** Re-validation in the loop does catch invalid cancellations. But the function is still open to griefing.

**Fix:** Add `onlySimulatedBackend` modifier or a check that `msg.sender` is the registered Chainlink Automation Forwarder address.

```solidity
address public automationForwarder;

modifier onlyForwarder() {
    require(msg.sender == automationForwarder, "Not forwarder");
    _;
}

function performUpkeep(bytes calldata performData) external override onlyForwarder { ... }
function setAutomationForwarder(address _forwarder) external onlyOwner { ... }
```

---

## HIGH Issues

### S3 — `emergencyRefund` Failed Refunds Not Tracked in `stuckFunds`

**File:** `contracts/CoinFlip.sol:711–723`

**Problem:** `performUpkeep` correctly records failed refunds to `stuckFunds[gameId]`. But `emergencyRefund` (admin function used during paused state) silently ignores failed transfers — no stuck fund is recorded, and the ETH is lost.

```solidity
// In emergencyRefund — NO stuck fund tracking on failure:
(bool successA, ) = game.playerA.call{value: refundAmount}("");
if (successA) totalRefund += refundAmount;  // ← failed refund silently ignored!
```

**Fix:** Record failed refunds to `stuckFunds` and emit `RefundFailed` events, same as `performUpkeep`.

---

### S4 — `recoverStuckFunds` Always Sends to `playerA`

**File:** `contracts/CoinFlip.sol:739–741`

**Problem:** Stuck funds (from `performUpkeep` failed refunds) should go to the creator (`playerA`). But if a LOCKED game's refund fails mid-VRF, both players contributed ETH. The `stuckFunds` mapping only records one refund amount, and recovery always goes to `playerA`, permanently losing `playerB`'s refund.

**Fix:** Track stuck funds per address, not per game:
```solidity
mapping(address => uint256) public stuckFunds;  // player → amount owed
```

---

### S5 — VRF Callback Gas Limit May Be Insufficient

**File:** `contracts/CoinFlip.sol:55`

**Problem:** `VRF_CALLBACK_GAS_LIMIT = 100,000`. The `fulfillRandomWords` function:
- Reads 3 storage slots (game, playerA stats, playerB stats)
- Writes 7+ storage values (winner, state, 6 stat fields)
- Transfers ETH
- Emits 3 events

On mainnet with high base fees, the transfer alone can consume significant gas if `winner` is a contract. If gas runs out mid-execution, the VRF callback reverts, the game stays LOCKED permanently, and players must wait for `vrfTimeoutBlocks` to claim refunds.

**Fix:** Increase `VRF_CALLBACK_GAS_LIMIT` to 200,000 or make it configurable.

---

### S6 — Event Indexer: Single Point of Failure

**File:** `scripts/event-indexer.ts`

**Problem:** The entire system's data layer depends on a single Node.js process. If it crashes:
- Games remain `pending` in the UI even after blockchain confirmation
- Users see stale data until the process is restarted
- No alerting mechanism built in

**Fix:**
1. Run two indexer instances in active-passive mode
2. Add a dead-man's-switch health check (fail if no block processed in N minutes)
3. Integrate with Sentry for crash alerts
4. Consider using Supabase Edge Functions or a managed service like Railway

---

## MEDIUM Issues

### S7 — Misleading Error in `rawFulfillRandomWords`

**File:** `contracts/CoinFlip.sol:1055–1057`

```solidity
if (msg.sender != address(i_vrfCoordinator)) {
    revert InvalidGameState();  // ← wrong error! Should be a dedicated error
}
```

Using `InvalidGameState` for coordinator verification makes debugging harder. Add a dedicated `NotVrfCoordinator` error.

---

### S8 — VRF Coordinator Zero-Address Check Reuses Wrong Error

**File:** `contracts/CoinFlip.sol:319`

```solidity
if (vrfCoordinator == address(0)) revert InvalidFeeRecipient(); // Reuse error for simplicity
```

This is documented as intentional but breaks client-side error parsing. Add `InvalidCoordinator` error.

---

### S9 — CSP Uses `unsafe-eval` in Production

**File:** `middleware.ts:89`

```javascript
script-src 'self' 'unsafe-inline' 'unsafe-eval';
```

`unsafe-eval` allows `eval()`, `new Function()`, and similar constructs — a significant XSS vector. This exists because Next.js uses eval in some code paths, but it should be investigated and removed if possible.

**Fix:** Test if removing `unsafe-eval` breaks anything. If Next.js 16 supports nonce-based CSP properly, migrate to nonce injection.

---

### S10 — Middleware Rate Limiter Is In-Memory

**File:** `middleware.ts:107`

```javascript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

In a serverless/edge environment (Vercel), each function invocation may get a fresh memory space. This rate limiter is effectively per-instance, not per-user. An attacker can bypass it by hitting different edge nodes.

**The RPC route (`/api/rpc`) correctly uses Upstash Redis for distributed rate limiting. The middleware should too, or simply rely on the route-level limiter.**

**Fix:** Remove the in-memory middleware rate limiter and rely on the route-level distributed limiter, or add Upstash to the middleware as well.

---

### S11 — O(n) Scan in `checkUpkeep`

**File:** `contracts/CoinFlip.sol:791`

```solidity
for (uint256 i = 0; i < openGameIds.length && count < MAX_BATCH_CANCEL; i++) {
```

With `MAX_OPEN_GAMES = 1000`, this scan runs up to 1000 iterations on every Automation tick. As the open games array grows, this gas cost increases. If it exceeds the Automation gas limit, expired games won't be cancelled automatically.

**Fix:** Maintain a separate sorted structure (by expiry block) or use a linked list for O(1) expiry detection. Alternatively, add an offset parameter to paginate through the array.

---

### S12 — Client-Side Rate Limiting Is Trivially Bypassable

**File:** `hooks/useContract.ts:16–19`

```typescript
const createGameLimiter = new RateLimiter(3, 60000);
const joinGameLimiter = new RateLimiter(5, 60000);
```

These are JavaScript objects in the browser — any user can bypass them by refreshing the page, opening a private tab, or calling the contract directly. These provide no real security, only UX friction.

**Reality:** The real rate limiting is in the smart contract (`maxGamesPerPlayer`, `TooManyActiveGames`). Client-side limits are fine as UX guards but should not be relied on for security.

---

## LOW Issues

### S13 — RPC Cache Is Per-Instance (No Cross-Instance Sharing)

**File:** `app/api/rpc/route.ts:128`

In-memory `responseCache` Map. Same concern as middleware rate limiter in serverless — each Vercel function instance has its own cache. Cache hit rates will be low in high-traffic serverless deployments.

**Fix:** Move cache to Upstash Redis for shared caching across instances (same TTLs). The rate limiter already has this infrastructure.

---

### S14 — No Timelocked Admin Functions

**File:** `contracts/CoinFlip.sol` (all `onlyOwner` functions)

Admin can change `feeBasisPoints`, `timeoutBlocks`, and `maxGamesPerPlayer` instantly without any delay. A compromised owner key could:
- Set fee to 10% (maximum) immediately
- Reduce `timeoutBlocks` to 10 to rush auto-cancellations
- Pause the contract (denying service)

**Fix for production:** Migrate to a `TimelockController` (OpenZeppelin) with a minimum 24-48 hour delay on parameter changes, while keeping `pause()` immediate for emergency response.

---

### S15 — Service Role Key Security

**File:** `scripts/event-indexer.ts:26`

The Supabase service role key (bypasses RLS) is stored in `.env.local`. If the indexer server is compromised, an attacker has full database write access.

**Fix:**
1. Use a dedicated Supabase JWT with only the specific permissions needed (INSERT/UPDATE on games, NOT full service role)
2. Rotate the key periodically
3. Store it in a secrets manager (Doppler, AWS Secrets Manager) rather than a file

---

### S16 — VRF Timeout UI Mismatch

**File:** `lib/constants.ts:39-42` vs `contracts/CoinFlip.sol:53`

```typescript
// Frontend shows:
export const VRF_TIMEOUT_SECONDS = 120;  // 2 minutes

// Contract actually requires:
vrfTimeoutBlocks = 200  // ~40 minutes on Sepolia at 12s/block
```

The UI tells users they can claim VRF timeout after 2 minutes, but the contract requires 200 blocks (~40 minutes). This creates serious UX confusion and may lead to failed transaction attempts.

**Fix:** Calculate the UI timeout from `vrfTimeoutBlocks × avgBlockTime` and update the constant to match.

---

### S17 — Single-Owner Contract (No Multi-sig)

For production with real funds, the contract owner should be a multi-signature wallet (Gnosis Safe) rather than a single EOA. A single private key compromise means complete control over fees, pausing, and refunds.

---

### S18 — `stuckFunds` Only Tracks `playerA` for OPEN Games

The `stuckFunds` mapping is only populated by `performUpkeep` which only cancels OPEN games (single player, only `playerA`). For LOCKED games that fail VRF, stuck funds from `claimVrfTimeout` or `emergencyRefund` are not tracked systematically.

---

## Contract Positive Findings

- ✅ **CEI pattern** — state updated before all external calls
- ✅ **ReentrancyGuard** — all state-changing functions protected
- ✅ **Pausable** — emergency stop available
- ✅ **Event emission** — all state changes emit events (16 events total)
- ✅ **Input validation** — all public functions validate inputs with custom errors
- ✅ **VRF race condition handled** — if game is cancelled before VRF returns, gracefully exits
- ✅ **O(1) array removal** — swap-and-pop pattern for `openGameIds`
- ✅ **MAX_OPEN_GAMES cap** — prevents unbounded array growth
- ✅ **Fee cap** — 10% maximum, hardcoded
- ✅ **Chainlink VRF V2.5** — state-of-the-art verifiable randomness

---

## Frontend Positive Findings

- ✅ **Input validation** — Zod schemas + custom validators throughout
- ✅ **Address sanitization** — regex validation before DB queries
- ✅ **Security headers** — X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy
- ✅ **CSRF protection** — Origin validation in middleware for state-changing requests
- ✅ **Distributed rate limiting** — Upstash Redis in RPC proxy
- ✅ **Method allowlist** — RPC proxy only allows 21 safe methods
- ✅ **Error boundary** — React error boundary prevents full app crashes
- ✅ **Notification deduplication** — prevents duplicate modals across devices/tabs

---

## Recommended Fix Priority

| Priority | Issues | Timeline |
|---|---|---|
| P0 (pre-mainnet) | S1, S2, S3, S4, S5, S6, S16 | Before any real money |
| P1 (launch) | S7, S8, S9, S10, S14, S17 | At launch or shortly after |
| P2 (post-launch) | S11, S12, S13, S15, S18 | First month |

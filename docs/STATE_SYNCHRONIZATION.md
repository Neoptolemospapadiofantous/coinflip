# State Synchronization Architecture

This document explains how the CoinFlip game maintains consistent state across the smart contract, database, and all connected players.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SMART CONTRACT                            │
│                     (Source of Truth)                            │
│  - GameCreated   │
│  - GameJoined    │  Event
│  - GameResolved  │  Emissions
│  - GameCancelled │
└────────┬─────────────────────────────────────────────────────────┘
         │
         │ Block Events
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EVENT INDEXER                               │
│                   (Contract → Database)                          │
│                                                                  │
│  - Listens to blockchain events                                 │
│  - Validates state consistency                                  │
│  - Updates database atomically                                  │
│  - Retries on failures (3x with exponential backoff)           │
│  - Reads contract state for missing data (joiner_choice)       │
└────────┬─────────────────────────────────────────────────────────┘
         │
         │ Database Updates
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE DATABASE                            │
│                  (Indexed State Cache)                           │
│                                                                  │
│  games table:                                                    │
│  - id, status, creator, joiner                                  │
│  - creator_choice, joiner_choice                                │
│  - coin_result, winner_address, payout                          │
│  - All transaction hashes and timestamps                        │
│                                                                  │
│  Real-time Subscriptions via WebSocket:                         │
│  - Channel: `game:{gameId}` (both players subscribe)           │
│  - Broadcasts UPDATE events to all subscribers                  │
└────────┬─────────────────────────────────────────────────────────┘
         │
         │ WebSocket UPDATE
         │ (Real-time Broadcast)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYER UIs (Both)                             │
│                 (useGameSync Hook)                               │
│                                                                  │
│  Player A subscribes: `game:{gameId}`                           │
│  Player B subscribes: `game:{gameId}` (SAME channel!)          │
│                                                                  │
│  On game update:                                                 │
│  1. Validate state (validateGameState)                          │
│  2. Check coin_result !== null                                  │
│  3. Verify winner choice matches coin_result                    │
│  4. Update local state only if valid                            │
│  5. Show modal/animation if valid                               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Game-Specific Subscription Channels

**Both players subscribe to the SAME channel: `game:{gameId}`**

This ensures:
- Players receive updates from the same source
- No race conditions from different channels
- Identical state transitions for both players
- Consistent timing for animations

**Alternative (BAD):**
```typescript
// ❌ DON'T: Player-specific channels
Player A: `player-games:0xAAA`
Player B: `player-games:0xBBB`
// Different channels = different timing = desynced state
```

**Current (GOOD):**
```typescript
// ✅ DO: Game-specific channel
Both players: `game:123`
// Same channel = same timing = synced state
```

### 2. Atomic Database Updates with Retry

Event indexer updates ALL fields in a single operation:

```typescript
await retryOperation(async () => {
  await supabase.from('games').update({
    winner_address: winner.toLowerCase(),
    coin_result: coinResult,        // ← Critical field
    payout: payout.toString(),
    status: 'resolved',
    resolved_tx_hash: txHash,
    resolved_block_number: blockNumber.toString(),
    resolved_at: new Date().toISOString(),
  }).eq('id', gameId.toString());
}, 3); // 3 retries with backoff
```

Benefits:
- No partial updates (all or nothing)
- Retries ensure eventual success
- Players never see inconsistent state
- Database ACID guarantees

### 3. State Validation Before Display

`validateGameState()` checks:

**For Resolved Games:**
1. ✅ `coin_result !== null` (required for animation)
2. ✅ `winner_address !== null` (must have winner)
3. ✅ `payout !== null` (must have payout amount)
4. ✅ `winner_choice === coin_result` (consistency check)

**Example Validation:**
```typescript
// Game #5 resolved
{
  status: 'resolved',
  coin_result: true,        // Tails
  winner_address: '0xAAA',
  creator_address: '0xAAA',
  creator_choice: true,     // Creator chose Tails ✅
  joiner_choice: false,     // Joiner chose Heads
}
// Validation: winner (creator) chose tails, coin_result is tails ✅
```

**Invalid State Example:**
```typescript
{
  status: 'resolved',
  coin_result: null,        // ❌ Missing!
  winner_address: '0xAAA',
}
// Modal shows: "Waiting for complete game data..."
// Animation: NOT shown
```

### 4. Joiner Choice Retrieval

The `GameJoined` event does NOT include `joinerChoice`, so we read it from contract:

```typescript
// Read contract state after event
const gameData = await publicClient.readContract({
  address: CONTRACT_ADDRESS,
  abi: COINFLIP_ABI,
  functionName: 'games',
  args: [BigInt(gameId)],
});

const joinerChoice = gameData.joinerChoice;
```

This ensures we have the complete game state for validation.

## State Flow Example

### Happy Path: Game Creation → Resolution

```
T0: Player A creates game (Heads)
    Contract emits: GameCreated(id=5, creator=0xAAA, choice=false)
    ↓
T1: Event indexer processes event
    Database: INSERT { id: 5, creator: 0xAAA, creator_choice: false, status: 'pending' }
    ↓
T2: Player B joins game (Tails)
    Contract emits: GameJoined(id=5, joiner=0xBBB)
    ↓
T3: Event indexer processes event + reads contract
    Reads: joinerChoice = true
    Database: UPDATE { joiner: 0xBBB, joiner_choice: true, status: 'matched' }
    WebSocket broadcasts: UPDATE to channel `game:5`
    ↓
T4: Both Player A and B receive WebSocket UPDATE
    Validate: ✅ status='matched', joiner_address exists
    Both modals show: "Game Matched! Waiting for VRF..."
    ↓
T5: Chainlink VRF resolves (coin lands on Tails)
    Contract emits: GameResolved(id=5, winner=0xBBB, coinResult=true)
    ↓
T6: Event indexer processes event
    Reads game from DB to validate
    Validates: winner (0xBBB) is joiner, joiner chose tails (true) ✅
    Database: UPDATE {
      winner: 0xBBB,
      coin_result: true,
      payout: '0.019 ETH',
      status: 'resolved'
    }
    WebSocket broadcasts: UPDATE to channel `game:5`
    ↓
T7: Both Player A and B receive SAME WebSocket UPDATE
    Validate: ✅ coin_result=true, winner=0xBBB, winner chose true
    Both modals show IDENTICAL coin flip animation
    Animation shows: 🪙 Tails
    Player A sees: "Better Luck Next Time"
    Player B sees: "You Won! 🎉"
```

### Error Recovery: Missing coin_result

```
T6: Event indexer processes GameResolved
    First attempt: Database write FAILS (network glitch)
    Retry 1 (after 1s): Database write FAILS
    Retry 2 (after 2s): Database write SUCCEEDS
    Database: UPDATE { status: 'resolved', winner: 0xBBB, coin_result: true, ... }
    WebSocket broadcasts: UPDATE to channel `game:5`
    ↓
T7: Players receive update
    Validate: ✅ All fields present
    Modals show animation
```

### Edge Case: Partial Update (Prevented)

**Without Validation (BAD):**
```
Database somehow has:
{ status: 'resolved', winner: 0xBBB, coin_result: null }

Players would see:
- Status shows "resolved"
- coin_result is null
- Animation tries to play with undefined result
- CRASH or wrong coin flip ❌
```

**With Validation (GOOD):**
```
Database has:
{ status: 'resolved', winner: 0xBBB, coin_result: null }

validateGameState() returns:
{ valid: false, errors: ['Resolved game missing coin_result'] }

Modal shows:
"⚠️ Waiting for complete game data..."
"Resolved game missing coin_result"

Animation: NOT shown ✅
Waits for next database update with coin_result
```

## Testing State Synchronization

### Manual Test: Two Players

1. Open two browser windows (Window A, Window B)
2. Window A: Create game, choose Heads
3. Window B: Join game, choose Tails
4. **Verify:** Both windows show "Game Matched!" modal simultaneously
5. **Verify:** Both modals show identical player choices and pot size
6. Wait for Chainlink VRF (10-30s)
7. **Verify:** Both windows show coin flip animation at the same time
8. **Verify:** Coin flip shows SAME result (e.g., both see Tails)
9. **Verify:** Winner sees "You Won!", loser sees "Better Luck Next Time"

### Automated Test: State Validation

```typescript
import { validateGameState } from '@/hooks/useGameSync';

// Test valid resolved game
const validGame = {
  id: '1',
  status: 'resolved',
  creator_address: '0xaaa',
  creator_choice: false,
  joiner_address: '0xbbb',
  joiner_choice: true,
  winner_address: '0xbbb',
  coin_result: true,
  payout: '100000000000000',
  // ... other fields
};

const result = validateGameState(validGame);
expect(result.valid).toBe(true);
expect(result.errors).toHaveLength(0);

// Test invalid: winner choice doesn't match result
const invalidGame = {
  ...validGame,
  winner_address: '0xaaa', // Creator won
  creator_choice: false,    // Creator chose Heads
  coin_result: true,        // But coin was Tails ❌
};

const invalidResult = validateGameState(invalidGame);
expect(invalidResult.valid).toBe(false);
expect(invalidResult.errors).toContain('Winner choice does not match coin result');
```

## Debugging

### Enable Debug Logs

All state sync operations log to console:

```
🔄 Subscribing to game 5 updates
📡 Subscription status for game 5: SUBSCRIBED
✅ Game 5 updated: { status: 'matched', coin_result: null }
🎮 Active game updated: matched
📢 Showing modal for game 5 (matched)
✅ Game 5 updated: { status: 'resolved', coin_result: true }
🎮 Active game updated: resolved
```

### Check for State Mismatch

If players see different results:

1. Open browser console in both windows
2. Look for `❌ STATE MISMATCH` error
3. Check `coin_result` value in both windows
4. Verify both are subscribed to same channel (`game:{id}`)

### Event Indexer Logs

```bash
pnpm indexer

# Should see:
🎉 GameResolved: ID=5, Winner=0xbbb, CoinResult=true, Payout=19000000000000
✅ Game 5 resolved successfully

# If validation fails:
❌ CRITICAL: Winner choice mismatch for game 5!
{
  winner: '0xbbb',
  coinResult: true,
  winnerIsCreator: false,
  actualWinnerChoice: true,
  expectedChoice: true
}
```

## Architecture Benefits

### 1. Consistency
- Single source of truth (smart contract)
- Atomic database updates
- Validation before display
- Both players see identical state

### 2. Reliability
- Retry logic handles transient failures
- State validation prevents partial updates
- Contract reads fill gaps in event data
- Graceful degradation (shows warning instead of crash)

### 3. User Experience
- Real-time updates via WebSocket
- Smooth synchronous animations
- Clear error messages when state is invalid
- No page refresh needed

### 4. Debuggability
- Comprehensive logging
- State validation errors clearly shown
- Channel subscriptions tracked
- Easy to verify both players in sync

## Future Improvements

1. **State Recovery**: If database is out of sync, re-index from contract
2. **Optimistic Updates**: Show pending state while waiting for confirmation
3. **Conflict Resolution**: Handle edge cases where contract and DB diverge
4. **Health Monitoring**: Alert when event indexer falls behind
5. **State Snapshots**: Periodic snapshots for faster recovery

## Summary

The CoinFlip state synchronization architecture ensures that:

✅ **Contract is source of truth** - All state originates from blockchain events
✅ **Database updates are atomic** - No partial state ever reaches players
✅ **Both players share same channel** - Identical timing and state
✅ **State is validated before display** - Invalid state shows warning, not crash
✅ **Retries handle failures** - Transient issues automatically recovered
✅ **Smooth coin flip experience** - Both players see same result simultaneously

This architecture provides a rock-solid foundation for fair, transparent, and synchronized gameplay.

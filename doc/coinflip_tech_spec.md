# Coin Flip Crypto Gambling Game
## Complete Technical & UX Specification v2.0

---

## Executive Summary

A non-custodial, peer-to-peer crypto coin-flip gambling game built on:
- **Security-first architecture** (zero backend custody)
- **Tier-based betting system** (optimal liquidity & UX)
- **Provably fair outcomes** (Chainlink VRF)
- **Casino-grade user experience** (instant feedback, smooth flows)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Security Philosophy](#2-core-security-philosophy)
3. [Technology Stack](#3-technology-stack)
4. [Bet Tier System](#4-bet-tier-system)
5. [Game Entry Modes](#5-game-entry-modes)
6. [Smart Contract Architecture](#6-smart-contract-architecture)
7. [Game Lifecycle](#7-game-lifecycle)
8. [UX Optimization](#8-ux-optimization)
9. [Database Schema](#9-database-schema)
10. [Security & Anti-Abuse](#10-security--anti-abuse)
11. [Additional Features](#11-additional-features)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Product Overview

### 1.1 What Is This?

A 1v1 coin-flip gambling game where:
- Two players wager cryptocurrency on a coin flip
- Outcome is cryptographically verifiable
- Winner receives automatic payout
- No trusted intermediaries required

### 1.2 Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Non-Custodial** | Smart contract-only escrow |
| **Provably Fair** | Chainlink VRF randomness |
| **Transparent** | All fees & odds visible |
| **Fast** | Optimized matching & UX |
| **Trustless** | No admin override powers |

### 1.3 Target Experience

```
User Journey: Start to Finish in 30 Seconds
┌─────────────────────────────────────────────────┐
│ 1. Select bet tier ($5/$10/$25/$50/$100)       │
│ 2. Choose Heads or Tails                       │
│ 3. Click "Play" → Auto-matched instantly       │
│ 4. Coin flips (animated)                       │
│ 5. Winner paid automatically                   │
│ 6. "Rematch" or "Change Bet" immediately       │
└─────────────────────────────────────────────────┘
```

---

## 2. Core Security Philosophy

### 2.1 Non-Negotiable Security Invariants

**These rules MUST NEVER be violated:**

1. ✅ Funds escrowed only in smart contracts
2. ✅ Randomness generated on-chain via VRF
3. ✅ Backend never signs or submits transactions
4. ✅ Frontend cannot influence outcomes
5. ✅ Every game is independently verifiable
6. ✅ No admin functions can move player funds
7. ✅ No admin functions can decide winners

**If any invariant breaks → system is fundamentally insecure**

### 2.2 Trust Boundaries

```
Component Trust Matrix
┌──────────────────────┬──────────────┬─────────────────┐
│ Component            │ Trust Level  │ Can Control     │
├──────────────────────┼──────────────┼─────────────────┤
│ Smart Contract       │ Trustless    │ Escrow, RNG     │
│ Blockchain           │ Trustless    │ Consensus       │
│ Chainlink VRF        │ Verifiable   │ Randomness      │
│ Frontend (React)     │ Untrusted    │ Display only    │
│ Supabase Backend     │ Semi-trusted │ Matching, UI    │
│ User Wallet          │ User-owned   │ Signatures      │
└──────────────────────┴──────────────┴─────────────────┘
```

### 2.3 What Each Component CANNOT Do

**Smart Contract:**
- ❌ Cannot know future randomness
- ❌ Cannot be paused mid-game
- ❌ Cannot change bet amounts after creation

**Backend (Supabase):**
- ❌ Cannot hold funds
- ❌ Cannot decide winners
- ❌ Cannot generate randomness
- ❌ Cannot force transactions
- ❌ Cannot sign on behalf of users

**Frontend:**
- ❌ Cannot create transactions without wallet approval
- ❌ Cannot modify on-chain state
- ❌ Cannot fake game outcomes

---

## 3. Technology Stack

### 3.1 Complete Stack

```
┌─────────────────────────────────────────────────┐
│                   USER LAYER                    │
│  Browser/Mobile → Wallet (MetaMask/WC)         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│                FRONTEND LAYER                   │
│  React + TypeScript                            │
│  wagmi + viem (Web3 interaction)               │
│  TanStack Query (state management)             │
│  Zustand (local state)                         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              BLOCKCHAIN LAYER                   │
│  EVM Chain: Polygon / Base / Arbitrum          │
│  Solidity 0.8.20+                              │
│  OpenZeppelin Contracts                        │
│  Chainlink VRF v2                              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│               BACKEND LAYER                     │
│  Supabase (Postgres + Auth + Edge)            │
│  Event Indexing (Edge Functions / The Graph)   │
│  Real-time subscriptions                       │
└─────────────────────────────────────────────────┘
```

### 3.2 Blockchain Selection Criteria

| Chain | Gas Cost | Speed | Ecosystem | Best For |
|-------|----------|-------|-----------|----------|
| **Polygon** | Very Low | Fast | Large | General users |
| **Base** | Low | Fast | Growing | Coinbase users |
| **Arbitrum** | Low | Fast | DeFi-rich | Crypto-native |
| **Optimism** | Low | Fast | Growing | Alternative |

**Recommendation:** Start with **Polygon** or **Base**

### 3.3 Frontend Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "typescript": "^5.0.0",
    "wagmi": "^2.0.0",
    "viem": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "@supabase/supabase-js": "^2.38.0",
    "lucide-react": "^0.263.1",
    "framer-motion": "^10.16.0"
  }
}
```

### 3.4 Smart Contract Dependencies

```solidity
// foundry.toml or hardhat.config.js
dependencies = [
  "@openzeppelin/contracts@5.0.0",
  "@chainlink/contracts@0.8.0"
]
```

---

## 4. Bet Tier System

### 4.1 Why Tiers?

**Problem with arbitrary amounts:**
- Slow matching
- Liquidity fragmentation
- UX confusion
- Complex queue logic

**Solution: Fixed tiers**

### 4.2 Default Tier Structure

```
TIER SYSTEM (USDC)
┌──────┬────────────┬─────────────┬──────────┐
│ Tier │ Bet Amount │ Pot (Total) │ Fee (2%) │
├──────┼────────────┼─────────────┼──────────┤
│  1   │    $5      │    $10      │  $0.20   │
│  2   │   $10      │    $20      │  $0.40   │
│  3   │   $25      │    $50      │  $1.00   │
│  4   │   $50      │   $100      │  $2.00   │
│  5   │  $100      │   $200      │  $4.00   │
└──────┴────────────┴─────────────┴──────────┘

Winner receives: Pot - Fee
```

### 4.3 Tier Benefits

✅ **Instant matching** (no range overlap calculations)  
✅ **Clear liquidity pools** (players per tier visible)  
✅ **Simple UI** (buttons instead of inputs)  
✅ **Better analytics** (tier-based metrics)  
✅ **No confusion** (everyone knows exact amounts)

### 4.4 Tier Configuration (On-Chain)

```solidity
struct Tier {
  uint256 amount;      // e.g., 5 USDC
  bool enabled;
  uint256 minBalance;  // Anti-spam threshold
}

mapping(uint8 => Tier) public tiers;
```

### 4.5 Custom/High-Roller Tier (Optional Phase 2)

```
Future Addition:
- "Custom" tier for whales
- Requires manual opponent matching
- Higher minimum (e.g., $500+)
```

---

## 5. Game Entry Modes

### 5.1 Mode A: Instant Match (Primary Experience)

**Purpose:** Fast, frictionless gameplay

**Flow:**
```
User Action                 System Response
──────────────────────────────────────────────
1. Select tier ($25)    → Validate balance
2. Choose Heads         → Lock choice
3. Click "Play"         → Enter tier queue
                          
[MATCHING HAPPENS]
                          
4. Auto-matched         → Notify both players
5. Both confirm         → Create on-chain game
6. Coin flips           → VRF resolves
7. Winner paid          → Show result
```

**UX Features:**
- Default mode
- Queue position visible
- Live player count
- Sound/vibration on match

**Example Screen:**

```
┌─────────────────────────────────┐
│      🪙 INSTANT MATCH 🪙        │
├─────────────────────────────────┤
│ Choose Your Bet:                │
│ [$5] [$10] [→$25←] [$50] [$100]│
│                                 │
│ Choose Side:                    │
│   🪙 Heads    🪙 Tails          │
│                                 │
│ Potential Win: $49 (Fee: $1)   │
│                                 │
│         [ PLAY NOW ]            │
│                                 │
│ 🟢 12 players in $25 queue     │
└─────────────────────────────────┘
```

### 5.2 Mode B: Public Game (Optional Control)

**Purpose:** 
- Stream visibility
- Friend challenges
- Transparent waiting

**Flow:**
```
1. Select tier
2. Create public game
3. Game appears in lobby
4. Wait for join
5. Standard resolution
```

**Use Cases:**
- Streamers showing they're available
- Friends challenging each other
- Marketing/tournaments

**Example Lobby Card:**

```
┌─────────────────────────────┐
│  $25 COIN FLIP             │
│  Creator: 0xA1B...C9       │
│  Choice: 🪙 Heads          │
│  [    JOIN GAME    ]       │
└─────────────────────────────┘
```

### 5.3 Entry Mode Comparison

| Feature | Instant Match | Public Game |
|---------|---------------|-------------|
| **Speed** | Fastest | Slower |
| **Control** | Low | High |
| **Visibility** | None | Public |
| **Best For** | Quick play | Friends/streaming |

---

## 6. Smart Contract Architecture

### 6.1 Contract Responsibilities

```
CoinFlip.sol Must Handle:
├── Tier management
├── Game creation
├── Game joining
├── Escrow (hold funds)
├── VRF randomness request
├── Game resolution
├── Automatic payouts
├── Fee collection
├── Timeout handling
└── Event emission
```

### 6.2 Global Parameters

```solidity
contract CoinFlip {
  // Immutable Constants
  uint8 public constant MAX_TIERS = 10;
  uint256 public constant FEE_BASIS_POINTS = 200; // 2%
  uint256 public constant TIMEOUT_BLOCKS = 100;
  
  // VRF Configuration
  uint64 public vrfSubscriptionId;
  bytes32 public vrfKeyHash;
  uint32 public vrfCallbackGasLimit = 100000;
  
  // Governance (Multisig Only)
  address public feeRecipient;
  bool public paused;
}
```

### 6.3 Core Data Structures

```solidity
enum GameState {
  NONE,      // 0: Doesn't exist
  OPEN,      // 1: Created, waiting for opponent
  LOCKED,    // 2: Both players joined, VRF pending
  RESOLVED,  // 3: Winner paid
  CANCELLED  // 4: Timeout, refunded
}

struct Game {
  address playerA;
  address playerB;
  uint8 tier;
  bool choiceA;      // false = heads, true = tails
  GameState state;
  uint256 vrfRequestId;
  address winner;
  uint256 createdBlock;
}

mapping(uint256 => Game) public games;
uint256 public nextGameId;
```

### 6.4 State Machine

```
Game State Transitions (Strict)

    NONE
      ↓
   [createGame()]
      ↓
    OPEN ─────────→ CANCELLED
      ↓            (timeout)
   [joinGame()]
      ↓
    LOCKED
      ↓
   [VRF callback]
      ↓
   RESOLVED

Rules:
- No state can be skipped
- No reverse transitions
- RESOLVED & CANCELLED are final
```

### 6.5 Key Functions

#### 6.5.1 Create Game

```solidity
function createGame(
  uint8 tier,
  bool choice
) external payable returns (uint256 gameId) {
  // Validations
  require(!paused, "Contract paused");
  require(tiers[tier].enabled, "Invalid tier");
  require(msg.value == tiers[tier].amount, "Incorrect bet");
  
  // Create game
  gameId = nextGameId++;
  games[gameId] = Game({
    playerA: msg.sender,
    playerB: address(0),
    tier: tier,
    choiceA: choice,
    state: GameState.OPEN,
    vrfRequestId: 0,
    winner: address(0),
    createdBlock: block.number
  });
  
  emit GameCreated(gameId, msg.sender, tier, choice);
}
```

#### 6.5.2 Join Game

```solidity
function joinGame(uint256 gameId) external payable {
  Game storage game = games[gameId];
  
  // Validations
  require(game.state == GameState.OPEN, "Not open");
  require(msg.sender != game.playerA, "Cannot join own game");
  require(msg.value == tiers[game.tier].amount, "Incorrect bet");
  
  // Lock game
  game.playerB = msg.sender;
  game.state = GameState.LOCKED;
  
  // Request VRF
  uint256 requestId = requestRandomWords();
  game.vrfRequestId = requestId;
  vrfRequests[requestId] = gameId;
  
  emit GameJoined(gameId, msg.sender);
}
```

#### 6.5.3 VRF Callback (Internal)

```solidity
function fulfillRandomWords(
  uint256 requestId,
  uint256[] memory randomWords
) internal override {
  uint256 gameId = vrfRequests[requestId];
  Game storage game = games[gameId];
  
  require(game.state == GameState.LOCKED, "Invalid state");
  
  // Compute result
  bool coinResult = (randomWords[0] % 2) == 0; // false=heads
  
  // Determine winner
  game.winner = (coinResult == game.choiceA)
    ? game.playerA
    : game.playerB;
  
  game.state = GameState.RESOLVED;
  
  // Payout
  _payout(gameId);
  
  emit GameResolved(gameId, game.winner, coinResult);
}
```

#### 6.5.4 Payout Logic

```solidity
function _payout(uint256 gameId) private {
  Game storage game = games[gameId];
  uint256 pot = tiers[game.tier].amount * 2;
  
  // Calculate fee
  uint256 fee = (pot * FEE_BASIS_POINTS) / 10000;
  uint256 payout = pot - fee;
  
  // Transfer
  payable(game.winner).transfer(payout);
  payable(feeRecipient).transfer(fee);
}
```

#### 6.5.5 Cancel Game (Timeout)

```solidity
function cancelGame(uint256 gameId) external {
  Game storage game = games[gameId];
  
  require(game.state == GameState.OPEN, "Not open");
  require(msg.sender == game.playerA, "Not creator");
  require(
    block.number >= game.createdBlock + TIMEOUT_BLOCKS,
    "Too early"
  );
  
  game.state = GameState.CANCELLED;
  
  // Refund
  payable(game.playerA).transfer(tiers[game.tier].amount);
  
  emit GameCancelled(gameId);
}
```

### 6.6 Security Features

```solidity
// OpenZeppelin integrations
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CoinFlip is 
  ReentrancyGuard,
  Pausable,
  Ownable,
  VRFConsumerBaseV2
{
  // All state-changing functions use nonReentrant
  // Emergency pause controlled by multisig
}
```

---

## 7. Game Lifecycle

### 7.1 Complete Flow (Instant Match)

```
PHASE 1: QUEUE ENTRY (Off-Chain)
┌────────────────────────────────────────┐
│ User selects tier → Enters Supabase   │
│ queue → FIFO matching logic            │
└────────────────────────────────────────┘
              ↓
PHASE 2: MATCH FOUND (Off-Chain)
┌────────────────────────────────────────┐
│ System finds match → Notifies both    │
│ players → Both see confirmation screen │
└────────────────────────────────────────┘
              ↓
PHASE 3: GAME CREATION (On-Chain)
┌────────────────────────────────────────┐
│ Player A creates game → Funds escrowed│
│ Game ID assigned → State: OPEN        │
└────────────────────────────────────────┘
              ↓
PHASE 4: GAME JOIN (On-Chain)
┌────────────────────────────────────────┐
│ Player B joins → Funds escrowed        │
│ State: LOCKED → VRF requested          │
└────────────────────────────────────────┘
              ↓
PHASE 5: RANDOMNESS (On-Chain)
┌────────────────────────────────────────┐
│ Chainlink VRF generates random number  │
│ Callback triggered → Coin result       │
└────────────────────────────────────────┘
              ↓
PHASE 6: RESOLUTION (On-Chain)
┌────────────────────────────────────────┐
│ Winner determined → Payout executed    │
│ State: RESOLVED → Events emitted       │
└────────────────────────────────────────┘
              ↓
PHASE 7: UI UPDATE (Off-Chain)
┌────────────────────────────────────────┐
│ Indexer catches event → Supabase       │
│ updated → Frontend shows result        │
└────────────────────────────────────────┘
```

### 7.2 Timing Breakdown

```
Typical Game Duration: 15-30 seconds

Queue Entry:       <1s    (off-chain)
Match Found:       <2s    (off-chain)
Create Game:       2-5s   (1 blockchain confirmation)
Join Game:         2-5s   (1 blockchain confirmation)
VRF Response:      3-10s  (VRF callback)
Payout:            instant (same tx as VRF)
UI Update:         <1s    (event indexing)
────────────────────────────────────────
Total:             ~15-30s from start to finish
```

### 7.3 Edge Cases & Handling

#### 7.3.1 Player Never Joins

```
Scenario: Game created, no one joins

Timeline:
- Block 1000: Game created
- Block 1100: Timeout reached
- Creator calls cancelGame()
- Full refund issued
- State: CANCELLED

Protection: TIMEOUT_BLOCKS constant
```

#### 7.3.2 VRF Delay

```
Scenario: VRF takes longer than expected

User Experience:
- Coin continues spinning
- Message: "Finalizing provably fair result..."
- No action required
- Resolves automatically when VRF responds

Technical: No timeout on VRF (cryptographic guarantee)
```

#### 7.3.3 Double Join Attempt

```
Scenario: Two players try to join simultaneously

Blockchain Behavior:
- First transaction mined wins
- Second transaction reverts
- Second player sees: "Already joined"

Prevention: State check in joinGame()
```

#### 7.3.4 Network Congestion

```
Scenario: High gas prices / slow blocks

User Experience:
- Transaction status clearly shown
- Estimated time displayed
- Option to speed up (increase gas)
- No funds lost if user waits

Backend: Multiple RPC providers for reliability
```

---

## 8. UX Optimization

### 8.1 UX First Principles

```
GOLDEN RULES:
1. Never leave users wondering what's happening
2. Every wait state must have feedback
3. No action should feel risky
4. Blockchain complexity is hidden, not removed
5. Losing should feel fair, winning should feel instant
```

### 8.2 Transaction Progress UI

**Always show these 5 phases:**

```
┌─────────────────────────────────────┐
│ TRANSACTION PROGRESS                │
├─────────────────────────────────────┤
│ ✓ 1. Wallet approval received      │
│ ⏳ 2. Transaction submitted         │
│ ⏳ 3. Confirming on blockchain      │
│ ⏳ 4. Securing randomness (VRF)     │
│ ⏳ 5. Paying winner                 │
│                                     │
│ Tx: 0xabc...def [Copy] [Explorer]  │
└─────────────────────────────────────┘
```

**Design Rules:**
- Checkmarks for completed steps
- Spinners for active steps
- Always show transaction hash
- Always show block explorer link
- Never say "processing" without specifics

### 8.3 Bet Selection Experience

```
┌──────────────────────────────────────────┐
│        🪙 CHOOSE YOUR BET 🪙            │
├──────────────────────────────────────────┤
│                                          │
│  [$5]  [$10]  [→$25←]  [$50]  [$100]   │
│                                          │
│  Balance: $127.50 USDC                  │
│                                          │
│  ────────────────────────────────────   │
│                                          │
│  Bet:          $25                      │
│  Potential Win: $49                     │
│  Fee:          $1                       │
│  Your Odds:    50% (provably fair)      │
│                                          │
│  ────────────────────────────────────   │
│                                          │
│  Choose Side:                           │
│                                          │
│    [  🪙 Heads  ]  [  🪙 Tails  ]      │
│                                          │
└──────────────────────────────────────────┘
```

**Interaction Rules:**
- Disabled tiers grayed out if balance insufficient
- Hover shows tier details
- One-tap selection
- Instant calculation preview
- No hidden fees

### 8.4 Queue Waiting Experience

```
┌──────────────────────────────────────┐
│     🔍 FINDING OPPONENT...          │
├──────────────────────────────────────┤
│                                      │
│  Tier: $25                          │
│  Your choice: Heads                 │
│                                      │
│  ⏱ Searching... 0:05                │
│                                      │
│  🟢 8 players in $25 queue          │
│  🟢 23 total players online         │
│                                      │
│  [ Cancel Search ]                  │
│                                      │
└──────────────────────────────────────┘
```

**Features:**
- Live timer
- Live player count per tier
- Cancel button (removes from queue)
- Sound/vibration on match
- Push notification if app backgrounded

### 8.5 Match Found Moment

```
┌──────────────────────────────────────┐
│      ⚡ OPPONENT FOUND! ⚡          │
├──────────────────────────────────────┤
│                                      │
│  Bet Amount: $25                    │
│                                      │
│  You:       🪙 Heads                │
│  Opponent:  🪙 Tails                │
│             (0x5AB...F21)           │
│                                      │
│  Pot:   $50                         │
│  Winner Gets: $49                   │
│                                      │
│  ────────────────────────────────   │
│                                      │
│     [ CONFIRM & FLIP ]              │
│                                      │
│  This creates an on-chain game.     │
│  You'll need to confirm 2 txs.      │
│                                      │
└──────────────────────────────────────┘
```

**Design Notes:**
- Clear opponent identifier
- Repeat bet details
- Explain what happens next
- No surprises

### 8.6 Coin Flip Animation

```
Animation Rules:
├── Starts after both bets confirmed
├── Cannot be skipped (fairness guarantee)
├── Continues until VRF callback
├── 3D coin rotation
├── Sound effects (optional, user-controlled)
└── Overlay text: "Verifying randomness..."

Duration:
- Minimum: 2 seconds (UX polish)
- Typical: 5-8 seconds (VRF response time)
- Maximum: 15 seconds (network delays)

If >15 seconds:
- Show additional message
- "This is taking longer than usual, but your funds are safe"
- "Blockchain randomness cannot be rushed"
```

### 8.7 Result Screen (Win)

```
┌──────────────────────────────────────┐
│                                      │
│          🎉 YOU WON! 🎉            │
│                                      │
│         +$49 USDC                   │
│                                      │
│  ────────────────────────────────   │
│                                      │
│  Result: 🪙 Heads                   │
│  Your choice: 🪙 Heads              │
│                                      │
│  ────────────────────────────────   │
│                                      │
│  ✓ Funds sent to your wallet        │
│  Tx: 0xabc...def [View]             │
│                                      │
│  ────────────────────────────────   │
│                                      │
│  [  Play Again  ]  [ Double Bet ]   │
│                                      │
│  [ Verify Fairness ▾ ]              │
│                                      │
└──────────────────────────────────────┘
```

### 8.8 Result Screen (Loss)

```
┌──────────────────────────────────────┐
│                                      │
│           😔 YOU LOST               │
│                                      │
│         -$25 USDC                   │
│                                      │
│  ────────────────────────────────   │
│                                      │
│  Result: 🪙 Tails                   │
│  Your choice: 🪙 Heads              │
│                                      │
│  ────────────────────────────────   │
│                                      │
│  This was a fair flip.              │
│  Better luck next time!             │
│                                      │
│  ────────────────────────────────   │
│                                      │
│  [  Try Again  ]  [ Change Bet ]    │
│                                      │
│  [ Verify Fairness ▾ ]              │
│                                      │
└──────────────────────────────────────┘
```

**Key Differences:**
- Empathetic messaging for losses
- Always offer "verify fairness"
- Clear CTAs for next action
- No frustration loops

### 8.9 Proof of Fairness Panel

**Expandable section on every result:**

```
┌─────────────────────────────────────────┐
│ [ ▼ Verify This Flip Was Fair ]        │
├─────────────────────────────────────────┤
│                                         │
│ ✓ Randomness Source: Chainlink VRF     │
│ ✓ Block Number: 18,392,882             │
│ ✓ VRF Request ID: 0x5ba...d91          │
│ ✓ Random Seed: 0x7fe...a43             │
│ ✓ Coin Result: Tails (seed % 2 = 1)    │
│                                         │
│ [  View on Block Explorer  ]            │
│ [  How Does This Work?  ]               │
│                                         │
└─────────────────────────────────────────┘
```

**Why This Matters:**
- 90% of users won't click
- 10% who do will trust the system more
- It's a massive trust signal just existing

### 8.10 Instant Rematch Feature

**After any game resolves:**

```
┌──────────────────────────────────────┐
│   Want to play again immediately?    │
├──────────────────────────────────────┤
│                                      │
│  Same opponent is ready!            │
│  Same bet: $25                      │
│                                      │
│  [ Rematch Now ]                    │
│                                      │
│  Or:                                │
│  [ Double or Nothing ($50) ]        │
│  [ Change Bet Amount ]              │
│  [ Find New Opponent ]              │
│                                      │
└──────────────────────────────────────┘
```

**Implementation:**
- New game, new randomness
- No state carryover
- Opponent must also accept
- 30-second window

**Retention Impact:**
- Reduces friction between games
- Increases sessions per user
- Builds rivalry/community feel

---

## 9. Database Schema

### 9.1 Supabase Tables

#### 9.1.1 users

```sql
CREATE TABLE users (
  wallet_address TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ,
  total_games INTEGER DEFAULT 0,
  total_wagered NUMERIC DEFAULT 0,
  total_won NUMERIC DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  loss_streak INTEGER DEFAULT 0
);

CREATE INDEX idx_users_last_seen ON users(last_seen DESC);
```

#### 9.1.2 games

```sql
CREATE TABLE games (
  id BIGSERIAL PRIMARY KEY,
  onchain_id BIGINT UNIQUE NOT NULL,
  tier INTEGER NOT NULL,
  bet_amount NUMERIC NOT NULL,
  token TEXT NOT NULL,
  state TEXT NOT NULL,
  
  player_a TEXT NOT NULL REFERENCES users(wallet_address),
  player_b TEXT REFERENCES users(wallet_address),
  choice_a BOOLEAN NOT NULL,
  
  winner TEXT REFERENCES users(wallet_address),
  coin_result BOOLEAN,
  
  tx_create TEXT,
  tx_join TEXT,
  tx_resolve TEXT,
  
  vrf_request_id TEXT,
  vrf_random_seed TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  CONSTRAINT valid_state CHECK (
    state IN ('OPEN', 'LOCKED', 'RESOLVED', 'CANCELLED')
  )
);

CREATE INDEX idx_games_state ON games(state) WHERE state = 'OPEN';
CREATE INDEX idx_games_player_a ON games(player_a);
CREATE INDEX idx_games_player_b ON games(player_b);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
```

#### 9.1.3 queues

```sql
CREATE TABLE queues (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES users(wallet_address),
  tier INTEGER NOT NULL,
  choice BOOLEAN NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT one_queue_per_wallet_tier UNIQUE (wallet, tier)
);

CREATE INDEX idx_queues_tier ON queues(tier, joined_at);
```

#### 9.1.4 matches (temporary table)

```sql
CREATE TABLE matches (
  id BIGSERIAL PRIMARY KEY,
  tier INTEGER NOT NULL,
  player_a TEXT NOT NULL,
  player_b TEXT NOT NULL,
  choice_a BOOLEAN NOT NULL,
  choice_b BOOLEAN NOT NULL,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  game_id BIGINT REFERENCES games(onchain_id),
  
  CONSTRAINT different_players CHECK (player_a != player_b)
);
```

### 9.2 Real-Time Subscriptions

```typescript
// Subscribe to open games for a tier
const gamesSubscription = supabase
  .channel('tier-3-games')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'games',
    filter: 'tier=eq.3AND state=eq.OPEN'
  }, (payload) => {
    updateGameList(payload.new);
  })
  .subscribe();

// Subscribe to queue count
const queueSubscription = supabase
  .channel('queue-counts')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'queues'
  }, () => {
    refreshQueueCounts();
  })
  .subscribe();
```

---

## 10. Security & Anti-Abuse

### 10.1 On-Chain Protections

```solidity
// Reentrancy protection
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

function _payout() private nonReentrant {
  // Protected against reentrancy attacks
}

// Self-match prevention
function joinGame(uint256 gameId) external {
  require(msg.sender != games[gameId].playerA, "Cannot join own game");
}

// Timeout enforcement
function cancelGame(uint256 gameId) external {
  require(
    block.number >= game.createdBlock + TIMEOUT_BLOCKS,
    "Too early to cancel"
  );
}

// Emergency pause
function pause() external onlyOwner {
  _pause();
}

// Pausable game creation
function createGame(...) external whenNotPaused {
  // ...
}
```

### 10.2 Off-Chain Protections

```typescript
// Rate limiting (Supabase Edge Function)
const rateLimits = {
  queueJoins: {
    window: '1 minute',
    maxAttempts: 10
  },
  gameCreations: {
    window: '1 minute',
    maxAttempts: 5
  }
};

// Wallet cooldown
async function canJoinQueue(wallet: string, tier: number) {
  const recentGames = await supabase
    .from('games')
    .select('resolved_at')
    .or(`player_a.eq.${wallet},player_b.eq.${wallet}`)
    .gte('resolved_at', new Date(Date.now() - 30000)) // 30s cooldown
    .limit(1);
  
  return recentGames.data.length === 0;
}

// Prevent duplicate queue entries
CREATE CONSTRAINT one_queue_per_wallet_tier 
  UNIQUE (wallet, tier);
```

### 10.3 Anti-Bot Measures

```typescript
// Minimum wallet requirements
interface WalletRequirements {
  minAge: number;        // Account must exist for X blocks
  minTxCount: number;    // Must have X previous transactions
  minBalance: number;    // Must have > tier amount + gas
}

// Invisible CAPTCHA on frontend (hCaptcha)
// Only triggered if suspicious behavior detected
```

### 10.4 Threat Model & Mitigations

```
┌──────────────────────┬────────────────────┬──────────────────┐
│ Threat               │ Attack Vector      │ Mitigation       │
├──────────────────────┼────────────────────┼──────────────────┤
│ Backend RNG Cheat    │ Fake randomness   │ VRF on-chain     │
│ Frontend Exploit     │ Modified client   │ Contract enforces│
│ Self-Match Farming   │ Same wallet join  │ Address check    │
│ Reentrancy           │ Callback exploit  │ ReentrancyGuard  │
│ Admin Rug            │ Drain funds       │ No such function │
│ Griefing             │ Never join game   │ Timeout + refund │
│ MEV/Front-running    │ Tx manipulation   │ Low MEV value    │
│ VRF Manipulation     │ Predict random    │ Impossible       │
│ Double-Join Race     │ Simultaneous join │ State lock       │
│ Queue Spam           │ Flood queue       │ Rate limits      │
└──────────────────────┴────────────────────┴──────────────────┘
```

### 10.5 Admin Powers (Strictly Limited)

```solidity
// What admins (multisig) CAN do:
✓ Pause new game creation (emergency)
✓ Update fee recipient address
✓ Enable/disable tiers
✓ Withdraw collected fees

// What admins CANNOT do:
✗ Cancel active games
✗ Modify game outcomes
✗ Withdraw player funds
✗ Change bet amounts mid-game
✗ Manipulate randomness
```

---

## 11. Additional Features

### 11.1 Responsible Gaming Tools

```
User-Controlled Limits (Optional, Off-Chain)

┌─────────────────────────────────────┐
│  Set Your Limits (Optional)         │
├─────────────────────────────────────┤
│                                     │
│  Daily Loss Limit: [$50]           │
│  Session Time Limit: [30 min]      │
│                                     │
│  [ Save Preferences ]               │
│                                     │
│  💡 These limits help you play     │
│  responsibly. You can change them  │
│  anytime in Settings.              │
│                                     │
└─────────────────────────────────────┘

Implementation:
- Stored in Supabase (user settings)
- Frontend enforces (soft limit)
- Can be disabled anytime
- Never stored on-chain
```

### 11.2 Game History & Statistics

```typescript
// User profile page
interface UserStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalWagered: bigint;
  totalWon: bigint;
  netProfit: bigint;
  currentStreak: number;
  longestWinStreak: number;
  favoriteT tier: number;
  lastPlayed: Date;
}

// Game history with verification
interface GameHistoryEntry {
  id: number;
  tier: number;
  result: 'WIN' | 'LOSS';
  amount: bigint;
  opponent: string;
  timestamp: Date;
  txHash: string;
  vrfProof: string;
  verifiable: true;
}
```

### 11.3 Leaderboards (Optional)

```sql
-- Daily volume leaderboard
CREATE VIEW daily_volume_leaders AS
SELECT 
  player_a as wallet,
  SUM(bet_amount * 2) as volume,
  COUNT(*) as games
FROM games
WHERE created_at >= CURRENT_DATE
GROUP BY player_a
ORDER BY volume DESC
LIMIT 10;

-- Win streak leaderboard
CREATE VIEW win_streak_leaders AS
SELECT
  wallet_address,
  win_streak,
  total_games
FROM users
WHERE win_streak >= 3
ORDER BY win_streak DESC, total_games DESC
LIMIT 10;
```

### 11.4 Notifications System

```typescript
// Push notifications (optional)
type NotificationEvent =
  | 'match_found'
  | 'game_resolved'
  | 'rematch_request'
  | 'game_cancelled';

// Web Push API integration
async function notifyUser(wallet: string, event: NotificationEvent) {
  // Only if user opted in
  const subscription = await getUserPushSubscription(wallet);
  if (!subscription) return;
  
  await sendPushNotification(subscription, {
    title: getNotificationTitle(event),
    body: getNotificationBody(event),
    icon: '/coin-icon.png'
  });
}
```

### 11.5 Referral System (Phase 2)

```typescript
// Simple referral tracking
interface Referral {
  referrer: string;
  referee: string;
  firstGamePlayed: Date;
  bonus: bigint; // Optional: small bonus for both
}

// Implementation: URL parameter
// https://app.coinflip.game?ref=0xABC...
```

---

## 12. Implementation Roadmap

### Phase 1: MVP (Weeks 1-4)

```
✅ Core smart contract
  ├── Tier system
  ├── Game creation/joining
  ├── VRF integration
  └── Basic security

✅ Essential frontend
  ├── Wallet connection
  ├── Bet selection UI
  ├── Game creation
  ├── Result display
  └── Transaction status

✅ Basic backend
  ├── Supabase setup
  ├── Event indexing
  ├── Queue matching
  └── Real-time updates

✅ Testing
  ├── Unit tests
  ├── Integration tests
  └── Testnet deployment
```

### Phase 2: Polish (Weeks 5-6)

```
✅ UX improvements
  ├── Coin flip animation
  ├── Sound effects
  ├── Instant rematch
  └── Mobile optimization

✅ Trust features
  ├── Proof of fairness panel
  ├── Game history
  └── Transparent stats page

✅ Anti-abuse
  ├── Rate limiting
  ├── Bot detection
  └── Cooldowns
```

### Phase 3: Growth (Weeks 7-8)

```
✅ Advanced features
  ├── Leaderboards
  ├── User profiles
  ├── Responsible gaming tools
  └── Push notifications

✅ Optimization
  ├── Gas optimization
  ├── Performance tuning
  └── Load testing

✅ Security audit
  ├── Smart contract audit
  └── Penetration testing
```

### Phase 4: Scale (Weeks 9+)

```
✅ Expansion
  ├── Additional chains
  ├── More token support
  ├── Referral system
  └── Tournament mode

✅ Community
  ├── Discord integration
  ├── Social features
  └── Marketing launch
```

---

## 13. Success Metrics

### 13.1 Technical KPIs

```
Contract Performance:
- Gas cost per game: <0.01 ETH equivalent
- VRF response time: <10s average
- Uptime: >99.9%

User Experience:
- Time to first game: <60s
- Queue wait time: <5s (tier-dependent)
- Transaction confirmation: <30s
```

### 13.2 Product KPIs

```
Engagement:
- Daily Active Users (DAU)
- Games per user per day
- Session length
- Repeat rate (D1, D7, D30)

Economics:
- Total Volume Locked (TVL)
- Daily volume
- Fee revenue
- Average bet size per tier

Trust:
- Fairness verifications clicked
- Customer support tickets
- Negative feedback rate
```

---

## 14. Risk Analysis & Mitigation

### 14.1 Technical Risks

```
┌────────────────────┬──────────┬─────────────────────┐
│ Risk               │ Severity │ Mitigation          │
├────────────────────┼──────────┼─────────────────────┤
│ Smart contract bug │ CRITICAL │ Audit + timelock    │
│ VRF failure        │ HIGH     │ Fallback mechanism  │
│ RPC downtime       │ MEDIUM   │ Multiple providers  │
│ Frontend exploit   │ MEDIUM   │ Contract validation │
│ Supabase outage    │ LOW      │ Graceful degradation│
└────────────────────┴──────────┴─────────────────────┘
```

### 14.2 Business Risks

```
┌────────────────────┬──────────┬─────────────────────┐
│ Risk               │ Severity │ Mitigation          │
├────────────────────┼──────────┼─────────────────────┤
│ Regulatory         │ HIGH     │ Legal review + geo  │
│ Low liquidity      │ MEDIUM   │ Tier system helps   │
│ Bot farms          │ MEDIUM   │ Anti-sybil measures │
│ Reputation damage  │ MEDIUM   │ Transparent ops     │
└────────────────────┴──────────┴─────────────────────┘
```

---

## 15. Conclusion

### What We've Built

This specification defines a **best-in-class Web3 gambling product** that is:

✅ **Trustless** – No custody, no manipulation  
✅ **Fast** – Tier-based instant matching  
✅ **Fair** – Verifiable VRF randomness  
✅ **Polished** – Casino-grade UX  
✅ **Scalable** – Multi-tier, multi-chain ready  
✅ **Secure** – Auditable, battle-tested patterns

### Why This Design Works

- **Tiers eliminate complexity** (no range matching)
- **VRF eliminates trust** (provably fair)
- **Queue system eliminates waiting** (fast matches)
- **Smart UX eliminates confusion** (clear feedback)
- **Security-first eliminates risk** (non-custodial)

### Next Steps

1. ✅ Review this spec with team
2. ✅ Begin smart contract development
3. ✅ Set up Supabase infrastructure
4. ✅ Build frontend MVP
5. ✅ Deploy to testnet
6. ✅ Security audit
7. ✅ Mainnet launch

---

## Appendix A: Code Snippets

### A.1 Frontend: Wallet Connection

```typescript
import { useAccount, useConnect } from 'wagmi';

export function ConnectWallet() {
  const { address } = useAccount();
  const { connect, connectors } = useConnect();

  if (address) {
    return <div>Connected: {address.slice(0, 6)}...</div>;
  }

  return (
    <button onClick={() => connect({ connector: connectors[0] })}>
      Connect Wallet
    </button>
  );
}
```

### A.2 Frontend: Create Game

```typescript
import { useWriteContract } from 'wagmi';

export function CreateGame({ tier, choice }: Props) {
  const { writeContract } = useWriteContract();
  
  const handleCreate = async () => {
    writeContract({
      address: COINFLIP_ADDRESS,
      abi: coinFlipABI,
      functionName: 'createGame',
      args: [tier, choice],
      value: TIER_AMOUNTS[tier]
    });
  };

  return <button onClick={handleCreate}>Create Game</button>;
}
```

### A.3 Backend: Queue Matching

```typescript
// Supabase Edge Function
export async function matchPlayers(tier: number) {
  const { data: waitingPlayers } = await supabase
    .from('queues')
    .select('*')
    .eq('tier', tier)
    .order('joined_at', { ascending: true })
    .limit(2);

  if (waitingPlayers.length < 2) return null;

  const [playerA, playerB] = waitingPlayers;
  
  // Prevent self-match
  if (playerA.wallet === playerB.wallet) return null;

  // Create match
  await supabase.from('matches').insert({
    tier,
    player_a: playerA.wallet,
    player_b: playerB.wallet,
    choice_a: playerA.choice,
    choice_b: playerB.choice,
    expires_at: new Date(Date.now() + 60000) // 60s
  });

  // Remove from queue
  await supabase
    .from('queues')
    .delete()
    .in('id', [playerA.id, playerB.id]);

  return { playerA, playerB };
}
```

---

## Appendix B: Security Checklist

```
Pre-Launch Security Audit Checklist

Smart Contract:
☐ Reentrancy protection verified
☐ Integer overflow/underflow impossible (Solidity 0.8+)
☐ Access control properly implemented
☐ Emergency pause mechanism tested
☐ VRF integration audited
☐ Gas optimization reviewed
☐ No unbounded loops
☐ External calls minimized

Frontend:
☐ Input validation on all forms
☐ XSS protection
☐ CSRF protection
☐ Secure wallet connection
☐ Transaction replay protection
☐ Error handling comprehensive

Backend:
☐ SQL injection prevention
☐ Rate limiting implemented
☐ API authentication required
☐ Environment variables secured
☐ Logging implemented
☐ Monitoring set up

Operational:
☐ Multisig wallet configured
☐ Incident response plan
☐ Bug bounty program
☐ Insurance considered
☐ Legal review completed
```

---

**Document Version:** 2.0  
**Last Updated:** 2024  
**Status:** Ready for Implementation


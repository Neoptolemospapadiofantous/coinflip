# Chainlink VRF Integration & Provable Fairness
## Complete Guide to Implementing Verifiable Randomness

---

## Document Purpose

This document provides everything needed to implement Chainlink VRF for provably fair coin flips:
- Complete VRF v2 integration
- Security considerations
- Gas optimization
- Testing VRF locally
- Troubleshooting common issues
- Alternative randomness methods (and why NOT to use them)

---

## Table of Contents

1. [Why VRF is Critical](#1-why-vrf-is-critical)
2. [How Chainlink VRF Works](#2-how-chainlink-vrf-works)
3. [VRF Implementation](#3-vrf-implementation)
4. [Subscription Management](#4-subscription-management)
5. [Testing VRF](#5-testing-vrf)
6. [Gas Costs & Optimization](#6-gas-costs--optimization)
7. [Error Handling](#7-error-handling)
8. [Security Considerations](#8-security-considerations)
9. [Alternative Methods (Why NOT)](#9-alternative-methods-why-not)

---

## 1. Why VRF is Critical

### 1.1 The Randomness Problem

```
TRADITIONAL RNG APPROACHES (ALL FLAWED):

❌ JavaScript Math.random()
   └── Predictable, client-controlled

❌ Block hash randomness
   └── Miner-manipulable

❌ Oracle with off-chain RNG
   └── Requires trusting oracle

❌ Commit-reveal schemes
   └── Vulnerable to griefing

✅ Chainlink VRF
   └── Cryptographically verifiable
   └── Impossible to predict
   └── Impossible to manipulate
   └── Provable on-chain
```

### 1.2 Why This Matters for Gambling

```typescript
// Scenario: Without VRF
function badCoinFlip() returns (bool) {
  // Using block hash - VULNERABLE
  uint256 random = uint256(blockhash(block.number - 1));
  return (random % 2) == 0;
  
  // Miner can:
  // 1. See the outcome before mining
  // 2. Choose NOT to mine if they would lose
  // 3. Effectively control 100% of outcomes
}

// With VRF: SECURE
function vrfCoinFlip(uint256 requestId, uint256 randomness) {
  // Randomness generated OFF-CHAIN by Chainlink
  // Cryptographically proven to be random
  // No one can predict or manipulate
  return (randomness % 2) == 0;
}
```

### 1.3 Legal & Trust Benefits

```
LEGAL REQUIREMENTS:
✅ Provably fair (many jurisdictions require this)
✅ Auditable randomness source
✅ No operator manipulation possible
✅ Players can verify outcomes

TRUST BENEFITS:
✅ "Don't trust, verify" - blockchain ethos
✅ Competitive advantage over centralized casinos
✅ Higher user confidence
✅ Better for marketing/PR
```

---

## 2. How Chainlink VRF Works

### 2.1 High-Level Flow

```
COMPLETE VRF FLOW:

1. GAME LOCKED
   ├── Both players have bet
   └── Contract calls requestRandomWords()

2. VRF REQUEST SENT
   ├── Request ID generated
   ├── Subscription charged LINK
   └── Oracle nodes notified

3. ORACLE GENERATES RANDOMNESS
   ├── Uses off-chain secure randomness source
   ├── Generates cryptographic proof
   └── Submits to VRF Coordinator

4. VRF COORDINATOR VERIFIES
   ├── Validates cryptographic proof
   ├── Ensures randomness is genuine
   └── Calls fulfillRandomWords()

5. YOUR CONTRACT RECEIVES CALLBACK
   ├── fulfillRandomWords() called
   ├── Randomness stored
   └── Game resolved

6. WINNER PAID
   └── All in same transaction as step 5
```

### 2.2 VRF Architecture

```
┌─────────────────────────────────────────┐
│         YOUR CONTRACT                   │
│  (CoinFlip.sol)                        │
│                                         │
│  requestRandomWords()                   │
│         │                              │
│         │ 1. Request                   │
│         ↓                              │
│  ┌──────────────────┐                 │
│  │ VRFConsumerBaseV2│                 │
│  └────────┬─────────┘                 │
└───────────┼──────────────────────────┘
            │
            │ 2. Forward Request
            ↓
┌─────────────────────────────────────────┐
│    CHAINLINK VRF COORDINATOR            │
│                                          │
│  - Manages subscriptions                │
│  - Routes requests to oracles           │
│  - Verifies proofs                      │
│  - Calls fulfillRandomWords()           │
└──────────┬──────────────────────────────┘
           │
           │ 3. Oracle Response
           ↓
┌─────────────────────────────────────────┐
│       CHAINLINK ORACLE NODES            │
│                                          │
│  - Generate secure randomness           │
│  - Create cryptographic proof           │
│  - Submit to coordinator                │
└─────────────────────────────────────────┘
```

### 2.3 Cryptographic Proof Explained

```
HOW VRF PROVES RANDOMNESS:

1. Oracle has a SECRET KEY (never revealed)
2. Oracle has a PUBLIC KEY (published on-chain)

3. To generate randomness:
   randomness = VRF_FUNCTION(secret_key, seed)
   proof = PROOF_FUNCTION(secret_key, seed, randomness)

4. Anyone can verify:
   verify(public_key, seed, randomness, proof) → true/false

5. Properties:
   ✅ Can't fake randomness without secret key
   ✅ Can't predict randomness without secret key
   ✅ Proof ensures randomness came from THIS oracle
   ✅ Deterministic given same inputs
```

---

## 3. VRF Implementation

### 3.1 Contract Setup

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

contract CoinFlip is VRFConsumerBaseV2 {
    // VRF Coordinator interface
    VRFCoordinatorV2Interface private immutable vrfCoordinator;
    
    // VRF Configuration
    uint64 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 100000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    
    // VRF request tracking
    mapping(uint256 => uint256) public vrfRequests; // requestId => gameId
    
    constructor(
        uint64 _subscriptionId,
        address _vrfCoordinator,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
    }
}
```

### 3.2 Requesting Randomness

```solidity
/**
 * @dev Internal function to request randomness
 * Called when both players have joined the game
 */
function _requestRandomness() private returns (uint256 requestId) {
    // Request random words from VRF Coordinator
    requestId = vrfCoordinator.requestRandomWords(
        keyHash,                // Gas lane key hash
        subscriptionId,         // Subscription ID
        REQUEST_CONFIRMATIONS,  // Number of confirmations
        CALLBACK_GAS_LIMIT,     // Gas limit for callback
        NUM_WORDS               // Number of random words
    );
    
    // CRITICAL: Store request ID immediately
    // This prevents race conditions
    emit RandomnessRequested(requestId, block.timestamp);
}

// Called from joinGame()
function joinGame(uint256 gameId) external payable {
    Game storage game = games[gameId];
    
    // Validations...
    require(game.state == GameState.OPEN, "Not open");
    require(msg.sender != game.playerA, "Can't join own");
    require(msg.value == tiers[game.tier].amount, "Wrong amount");
    
    // CRITICAL: Update state BEFORE requesting randomness
    game.playerB = msg.sender;
    game.state = GameState.LOCKED;
    
    // Request randomness
    uint256 requestId = _requestRandomness();
    
    // Map request to game
    game.vrfRequestId = requestId;
    vrfRequests[requestId] = gameId;
    
    emit GameJoined(gameId, msg.sender, requestId);
}
```

### 3.3 Receiving Randomness (Callback)

```solidity
/**
 * @dev Callback function called by VRF Coordinator
 * CRITICAL: Only VRF Coordinator can call this
 * This is enforced by VRFConsumerBaseV2
 */
function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    // Get game ID from request
    uint256 gameId = vrfRequests[requestId];
    Game storage game = games[gameId];
    
    // CRITICAL: Validate game state
    require(game.state == GameState.LOCKED, "Invalid state");
    require(game.vrfRequestId == requestId, "Request mismatch");
    
    // Get random word
    uint256 randomWord = randomWords[0];
    
    // Compute coin flip result
    // Taking modulo 2 gives fair 50/50 odds
    bool coinResult = (randomWord % 2) == 1;
    
    // Store result
    game.coinResult = coinResult;
    
    // Determine winner
    // If coin matches playerA's choice, playerA wins
    address winner = (coinResult == game.choiceA) 
        ? game.playerA 
        : game.playerB;
    
    address loser = (winner == game.playerA) 
        ? game.playerB 
        : game.playerA;
    
    // Update game state
    game.winner = winner;
    game.loser = loser;
    game.state = GameState.RESOLVED;
    
    // Execute payout immediately
    _payout(gameId);
    
    // Emit event with ALL relevant data
    emit GameResolved(
        gameId,
        winner,
        loser,
        coinResult,
        randomWord,
        block.timestamp
    );
}
```

### 3.4 Complete Event Definitions

```solidity
event RandomnessRequested(
    uint256 indexed requestId,
    uint256 timestamp
);

event GameResolved(
    uint256 indexed gameId,
    address indexed winner,
    address indexed loser,
    bool coinResult,      // false = heads, true = tails
    uint256 randomSeed,   // The actual random number
    uint256 timestamp
);
```

---

## 4. Subscription Management

### 4.1 Creating a Subscription

```typescript
// scripts/create-vrf-subscription.ts
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // VRF Coordinator address (network-specific)
    const VRF_COORDINATOR = "0xAE975071Be8F8eE67addBC1A82488F1C24858067"; // Polygon
    
    const coordinator = await ethers.getContractAt(
        "VRFCoordinatorV2Interface",
        VRF_COORDINATOR
    );
    
    // Create subscription
    const tx = await coordinator.createSubscription();
    const receipt = await tx.wait();
    
    // Get subscription ID from event
    const event = receipt.events?.find(
        e => e.event === "SubscriptionCreated"
    );
    const subscriptionId = event?.args?.subId;
    
    console.log(`✅ Subscription created: ${subscriptionId}`);
    console.log(`📝 Save this ID in your .env file`);
    console.log(`📝 Fund it at: https://vrf.chain.link/polygon`);
    
    return subscriptionId;
}

main();
```

### 4.2 Funding Subscription

```bash
# Option 1: Via Chainlink UI (Recommended)
# 1. Visit https://vrf.chain.link/polygon
# 2. Connect wallet
# 3. Find your subscription
# 4. Click "Add Funds"
# 5. Send LINK tokens

# Option 2: Programmatically
npx hardhat run scripts/fund-subscription.ts --network polygon
```

```typescript
// scripts/fund-subscription.ts
async function fundSubscription(subscriptionId: number, amount: string) {
    const LINK_TOKEN = "0xb0897686c545045aFc77CF20eC7A532E3120E0F1"; // Polygon
    
    const link = await ethers.getContractAt("IERC20", LINK_TOKEN);
    const coordinator = await ethers.getContractAt(
        "VRFCoordinatorV2Interface",
        VRF_COORDINATOR
    );
    
    // Approve LINK
    await link.approve(VRF_COORDINATOR, ethers.utils.parseEther(amount));
    
    // Fund subscription
    await coordinator.fundSubscription(
        subscriptionId,
        ethers.utils.parseEther(amount)
    );
    
    console.log(`✅ Funded ${amount} LINK to subscription ${subscriptionId}`);
}
```

### 4.3 Adding Consumer Contract

```typescript
// scripts/add-consumer.ts
async function addConsumer(
    subscriptionId: number,
    consumerAddress: string
) {
    const coordinator = await ethers.getContractAt(
        "VRFCoordinatorV2Interface",
        VRF_COORDINATOR
    );
    
    await coordinator.addConsumer(subscriptionId, consumerAddress);
    
    console.log(`✅ Added ${consumerAddress} as consumer`);
}

// After deploying your contract:
await addConsumer(SUBSCRIPTION_ID, coinFlipAddress);
```

### 4.4 Monitoring Subscription

```typescript
// scripts/check-subscription.ts
async function checkSubscription(subscriptionId: number) {
    const coordinator = await ethers.getContractAt(
        "VRFCoordinatorV2Interface",
        VRF_COORDINATOR
    );
    
    const subscription = await coordinator.getSubscription(subscriptionId);
    
    console.log("Subscription Info:");
    console.log(`Balance: ${ethers.utils.formatEther(subscription.balance)} LINK`);
    console.log(`Owner: ${subscription.owner}`);
    console.log(`Consumers: ${subscription.consumers.length}`);
    
    // Alert if balance is low
    const balanceLINK = parseFloat(ethers.utils.formatEther(subscription.balance));
    if (balanceLINK < 5) {
        console.warn(`⚠️ Low balance! Only ${balanceLINK} LINK remaining`);
        console.warn(`Fund at: https://vrf.chain.link/polygon`);
    }
    
    return subscription;
}
```

---

## 5. Testing VRF

### 5.1 Local Testing with Mock

```solidity
// test/mocks/VRFCoordinatorV2Mock.sol
// Use Chainlink's official mock for testing

import "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol";

contract VRFTest is Test {
    VRFCoordinatorV2Mock coordinator;
    CoinFlip coinFlip;
    
    function setUp() public {
        // Deploy mock coordinator
        coordinator = new VRFCoordinatorV2Mock(
            100000000000000000, // 0.1 LINK base fee
            1000000000          // 1 gwei per gas
        );
        
        // Create subscription
        uint64 subId = coordinator.createSubscription();
        
        // Fund subscription with mock LINK
        coordinator.fundSubscription(subId, 10 ether);
        
        // Deploy CoinFlip
        coinFlip = new CoinFlip(
            subId,
            address(coordinator),
            KEY_HASH
        );
        
        // Add consumer
        coordinator.addConsumer(subId, address(coinFlip));
    }
    
    function testCoinFlipWithVRF() public {
        // Create game
        coinFlip.createGame{value: 1 ether}(0, false);
        
        // Join game (triggers VRF request)
        vm.prank(user2);
        coinFlip.joinGame{value: 1 ether}(0);
        
        // Get request ID
        uint256 requestId = coinFlip.games(0).vrfRequestId;
        
        // Manually fulfill VRF request
        coordinator.fulfillRandomWords(requestId, address(coinFlip));
        
        // Verify game resolved
        CoinFlip.Game memory game = coinFlip.games(0);
        assertEq(uint(game.state), uint(CoinFlip.GameState.RESOLVED));
        assertTrue(game.winner != address(0));
    }
    
    function testRandomnessDistribution() public {
        uint256 headsCount = 0;
        uint256 gamesPlayed = 100;
        
        for (uint256 i = 0; i < gamesPlayed; i++) {
            // Create and join game
            coinFlip.createGame{value: 1 ether}(0, false);
            vm.prank(user2);
            coinFlip.joinGame{value: 1 ether}(i);
            
            // Fulfill with different random values
            uint256 requestId = coinFlip.games(i).vrfRequestId;
            coordinator.fulfillRandomWords(requestId, address(coinFlip));
            
            // Count results
            if (!coinFlip.games(i).coinResult) headsCount++;
        }
        
        // Should be roughly 50/50 (allow ±20% variance)
        assertGt(headsCount, 30);
        assertLt(headsCount, 70);
    }
}
```

### 5.2 Testnet Testing

```typescript
// test/integration/testnet-vrf.test.ts
describe("Testnet VRF Integration", () => {
    it("should resolve game with real VRF", async () => {
        // Deploy to Mumbai testnet
        const coinFlip = await deployCoinFlip(MUMBAI_CONFIG);
        
        // Create game
        await coinFlip.createGame(0, false, { value: tier0Amount });
        
        // Join game
        await coinFlip.connect(user2).joinGame(0, { value: tier0Amount });
        
        // Wait for VRF callback
        // This can take 30-60 seconds on testnet
        console.log("Waiting for VRF callback...");
        
        await new Promise((resolve) => {
            coinFlip.on("GameResolved", (gameId, winner, loser, coinResult) => {
                console.log(`Game resolved: ${coinResult ? 'Tails' : 'Heads'}`);
                console.log(`Winner: ${winner}`);
                resolve();
            });
            
            // Timeout after 2 minutes
            setTimeout(() => {
                throw new Error("VRF callback timeout");
            }, 120000);
        });
    });
});
```

---

## 6. Gas Costs & Optimization

### 6.1 VRF Gas Breakdown

```
TOTAL GAS COST PER GAME:

1. requestRandomWords()
   ├── Base: ~100,000 gas
   ├── Verification: ~80,000 gas
   └── Callback: YOUR_CALLBACK_GAS_LIMIT

2. fulfillRandomWords() callback
   ├── Your contract logic: depends on implementation
   ├── Payout transfer: ~21,000 gas
   └── Events: ~5,000 gas per event

TOTAL ESTIMATE:
├── Optimized: ~250,000 gas
├── Typical: ~300,000 gas
└── Complex: ~400,000 gas

LINK PAYMENT:
└── Calculated dynamically based on gas price
```

### 6.2 Optimizing Callback Gas

```solidity
// ❌ BAD: Expensive callback
function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    uint256 gameId = vrfRequests[requestId];
    Game storage game = games[gameId];
    
    // Multiple SLOADs (expensive)
    require(game.playerA != address(0));
    require(game.playerB != address(0));
    require(game.state == GameState.LOCKED);
    
    // Complex computation in callback
    uint256 result = complexCalculation(randomWords[0]);
    
    // Multiple state updates
    game.coinResult = result % 2 == 0;
    game.randomSeed = randomWords[0];
    game.timestamp = block.timestamp;
    // ... more updates
}

// ✅ GOOD: Optimized callback
function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    uint256 gameId = vrfRequests[requestId];
    Game storage game = games[gameId];
    
    // Single state check
    require(game.state == GameState.LOCKED, "Invalid state");
    
    // Simple, direct computation
    bool coinResult = (randomWords[0] % 2) == 1;
    
    // Determine winner inline
    address winner = (coinResult == game.choiceA) 
        ? game.playerA 
        : game.playerB;
    
    // Minimal state updates
    game.winner = winner;
    game.loser = (winner == game.playerA) ? game.playerB : game.playerA;
    game.state = GameState.RESOLVED;
    
    // Payout immediately (no extra function call)
    _payout(gameId);
}
```

### 6.3 Setting Optimal Gas Limit

```solidity
// How to choose CALLBACK_GAS_LIMIT

// 1. Measure your callback gas usage
uint32 private constant CALLBACK_GAS_LIMIT = 100000;

// Too low: Callback fails, subscription not charged, game stuck
// Too high: Overpay for gas

// Formula:
// CALLBACK_GAS_LIMIT = (Actual Gas Used) + 20% buffer

// Example measurements:
// Simple payout: 60,000 gas → Set to 75,000
// With events: 80,000 gas → Set to 100,000
// Complex logic: 120,000 gas → Set to 150,000
```

---

## 7. Error Handling

### 7.1 Common VRF Errors

```solidity
// Error 1: Subscription not funded
error InsufficientLINK();

// Error 2: Consumer not added
error InvalidConsumer();

// Error 3: Invalid request ID
error InvalidRequest();

// Error 4: Callback gas limit too low
error CallbackGasExceeded();

// Handling in contract
function _requestRandomness() private returns (uint256) {
    try vrfCoordinator.requestRandomWords(
        keyHash,
        subscriptionId,
        REQUEST_CONFIRMATIONS,
        CALLBACK_GAS_LIMIT,
        NUM_WORDS
    ) returns (uint256 requestId) {
        return requestId;
    } catch Error(string memory reason) {
        revert(string.concat("VRF request failed: ", reason));
    }
}
```

### 7.2 Handling Failed Callbacks

```solidity
// Problem: What if VRF callback never arrives?

// Solution 1: Timeout mechanism (Recommended)
uint256 public constant VRF_TIMEOUT = 1 hours;

function cancelStuckGame(uint256 gameId) external {
    Game storage game = games[gameId];
    
    require(game.state == GameState.LOCKED, "Not locked");
    require(
        block.timestamp > game.joinedBlock + VRF_TIMEOUT,
        "Too early"
    );
    
    // Refund both players
    _refundBothPlayers(gameId);
    
    game.state = GameState.CANCELLED;
    
    emit GameCancelledDueToVRFTimeout(gameId);
}

// Solution 2: Manual resolution (Multisig only, emergency)
function emergencyResolveGame(
    uint256 gameId,
    bool coinResult
) external onlyOwner whenPaused {
    // Only callable when contract is paused
    // Requires multisig approval
    // Used as last resort
    
    Game storage game = games[gameId];
    require(game.state == GameState.LOCKED, "Not locked");
    
    // Resolve manually
    game.coinResult = coinResult;
    address winner = (coinResult == game.choiceA) 
        ? game.playerA 
        : game.playerB;
    
    game.winner = winner;
    game.state = GameState.RESOLVED;
    
    _payout(gameId);
    
    emit GameManuallyResolved(gameId, winner);
}
```

---

## 8. Security Considerations

### 8.1 Critical Security Rules

```solidity
// ✅ RULE 1: Only VRF Coordinator can call fulfillRandomWords
// This is enforced by VRFConsumerBaseV2

function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    // ✅ Already protected - only coordinator can call this
}

// ❌ NEVER expose this publicly
function fulfillRandomWordsPUBLIC(
    uint256 requestId,
    uint256[] memory randomWords
) public {
    // VULNERABLE! Anyone can call and manipulate outcome
}

// ✅ RULE 2: Validate game state
function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    Game storage game = games[vrfRequests[requestId]];
    
    // CRITICAL: Prevent double-resolution
    require(game.state == GameState.LOCKED, "Invalid state");
    
    // CRITICAL: Prevent request ID manipulation
    require(game.vrfRequestId == requestId, "Request mismatch");
}

// ✅ RULE 3: Use randomness correctly
function determineWinner(uint256 randomness) internal pure returns (bool) {
    // ✅ CORRECT: Simple modulo
    return (randomness % 2) == 1;
    
    // ❌ WRONG: Don't manipulate unnecessarily
    return ((randomness * block.timestamp) % 2) == 1;
    // Adding block.timestamp reduces randomness quality
}

// ✅ RULE 4: Never let users choose when to request randomness
function joinGame(uint256 gameId) external payable {
    // ✅ CORRECT: Request immediately when game condition met
    game.state = GameState.LOCKED;
    _requestRandomness();
    
    // ❌ WRONG: Let user decide when to flip
    // function flipCoin(uint256 gameId) external {
    //     _requestRandomness();
    // }
    // User could observe blockchain and time their request
}
```

### 8.2 Subscription Security

```solidity
// Protect against subscription draining

// ✅ Set reasonable gas limits
uint32 private constant CALLBACK_GAS_LIMIT = 100000;

// ✅ Monitor subscription balance
function checkSubscriptionHealth() external view returns (bool healthy) {
    (uint96 balance, , ,) = vrfCoordinator.getSubscription(subscriptionId);
    
    // Alert if less than 5 LINK
    return balance >= 5 ether;
}

// ✅ Have refill procedure
function getSubscriptionBalance() external view returns (uint96) {
    (uint96 balance, , ,) = vrfCoordinator.getSubscription(subscriptionId);
    return balance;
}
```

---

## 9. Alternative Methods (Why NOT)

### 9.1 Block Hash Randomness (INSECURE)

```solidity
// ❌ NEVER DO THIS
function badRandomness() internal view returns (uint256) {
    return uint256(keccak256(abi.encodePacked(
        blockhash(block.number - 1),
        block.timestamp,
        msg.sender
    )));
}

// Why it's bad:
// 1. Miners can see outcome before mining
// 2. Miners can choose not to mine if they would lose
// 3. In extreme cases, miners can manipulate
// 4. Easily exploitable in high-value games
```

### 9.2 Commit-Reveal (COMPLEX, GRIEFABLE)

```solidity
// ❌ NOT RECOMMENDED for this use case
function commitPhase(bytes32 commitment) external {
    // Player commits hash(secret + choice)
}

function revealPhase(uint256 secret, bool choice) external {
    // Player reveals secret
}

// Why it's problematic:
// 1. Requires 2 transactions per player (expensive)
// 2. Second player can grief by never revealing
// 3. Need complex timeout mechanisms
// 4. Poor UX (waiting for reveals)
// 5. VRF is simpler and more secure
```

### 9.3 Oracle with Off-Chain RNG (TRUST REQUIRED)

```solidity
// ❌ Requires trusting oracle
function oracleRandomness() external onlyOracle {
    // Oracle provides randomness
    // But how do you verify it's truly random?
    // Oracle could collude with players
}

// Why VRF is better:
// ✅ VRF provides cryptographic proof
// ✅ No need to trust the oracle
// ✅ Anyone can verify randomness
```

---

## 10. Production Checklist

```
BEFORE MAINNET DEPLOYMENT:

VRF SETUP:
☐ Subscription created
☐ Subscription funded (50+ LINK recommended)
☐ Consumer contract added to subscription
☐ Correct network coordinator address
☐ Correct key hash for network
☐ Gas limit tested and optimized

CONTRACT:
☐ fulfillRandomWords is internal override
☐ State validation in callback
☐ Request ID tracking implemented
☐ Timeout mechanism for stuck games
☐ Emergency resolution procedure documented

TESTING:
☐ Unit tests with mock VRF
☐ Integration tests on testnet
☐ Gas costs measured
☐ Randomness distribution verified (>1000 samples)
☐ Failure scenarios tested

MONITORING:
☐ Subscription balance alerts set up
☐ VRF callback time monitoring
☐ Failed VRF request alerts
☐ Automated refill procedure

DOCUMENTATION:
☐ VRF flow documented for auditors
☐ Subscription management procedures
☐ Emergency procedures written
☐ User-facing fairness explanation
```

---

## Conclusion

Chainlink VRF provides:

✅ **Cryptographically verifiable randomness**  
✅ **Impossible to predict or manipulate**  
✅ **Legal and regulatory compliance**  
✅ **User trust and transparency**  
✅ **Production-ready reliability**

**This is the ONLY acceptable randomness solution for a production gambling application.**

All other methods have fatal security flaws or UX problems. VRF is the industry standard for a reason.


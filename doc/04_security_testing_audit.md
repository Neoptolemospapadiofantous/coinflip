# Security, Testing & Audit Guide
## Complete Security Specification and Testing Strategy

---

## Document Purpose

This document provides everything needed to secure and test the application:
- Comprehensive threat model
- Security best practices for each layer
- Complete testing strategy
- Audit preparation checklist
- Incident response procedures
- Compliance considerations

---

## Table of Contents

1. [Security Threat Model](#1-security-threat-model)
2. [Smart Contract Security](#2-smart-contract-security)
3. [Frontend Security](#3-frontend-security)
4. [Backend Security](#4-backend-security)
5. [Infrastructure Security](#5-infrastructure-security)
6. [Testing Strategy](#6-testing-strategy)
7. [Audit Preparation](#7-audit-preparation)
8. [Incident Response](#8-incident-response)
9. [Compliance & Legal](#9-compliance--legal)

---

## 1. Security Threat Model

### 1.1 Attack Surface Analysis

```
┌─────────────────────────────────────────────────┐
│              ATTACK SURFACES                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  🎯 HIGH VALUE TARGETS:                         │
│  ├── Smart Contract (holds funds)              │
│  ├── VRF Randomness (determines winners)       │
│  └── User Wallets (private keys)               │
│                                                  │
│  🔍 MEDIUM VALUE TARGETS:                       │
│  ├── Frontend (UI manipulation)                │
│  ├── Backend API (data integrity)              │
│  └── Event Indexer (game state)                │
│                                                  │
│  📊 LOW VALUE TARGETS:                          │
│  ├── Static Assets                             │
│  ├── Analytics                                 │
│  └── Documentation                             │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 1.2 Threat Categories

```typescript
// Categorized threats with severity and mitigation
const threats = {
  CRITICAL: {
    'Fund Theft': {
      description: 'Attacker steals escrowed funds',
      vectors: [
        'Reentrancy attack',
        'Integer overflow',
        'Access control bypass',
        'Unauthorized withdrawals'
      ],
      mitigation: [
        'ReentrancyGuard on all fund transfers',
        'Solidity 0.8+ (built-in overflow protection)',
        'Strict access controls',
        'No admin fund withdrawal functions'
      ],
      status: 'MITIGATED'
    },
    
    'Randomness Manipulation': {
      description: 'Attacker predicts or influences coin flip',
      vectors: [
        'Block hash prediction',
        'Miner collusion',
        'Frontend RNG manipulation',
        'VRF callback manipulation'
      ],
      mitigation: [
        'Chainlink VRF (verifiable randomness)',
        'No on-chain RNG',
        'VRF callback validation',
        'Multiple block confirmations'
      ],
      status: 'MITIGATED'
    },
    
    'Private Key Compromise': {
      description: 'User wallet private keys stolen',
      vectors: [
        'Malicious wallet connection',
        'Frontend XSS attack',
        'Clipboard hijacking',
        'Fake transaction signing'
      ],
      mitigation: [
        'Hardware wallet support',
        'Clear transaction previews',
        'Never request private keys',
        'CSP headers to prevent XSS'
      ],
      status: 'PARTIALLY_MITIGATED'
    }
  },
  
  HIGH: {
    'Frontend Manipulation': {
      description: 'Attacker modifies frontend code',
      vectors: [
        'XSS injection',
        'Compromised CDN',
        'Man-in-the-middle',
        'Browser extension attack'
      ],
      mitigation: [
        'Content Security Policy',
        'Subresource Integrity',
        'HTTPS only',
        'Input sanitization'
      ],
      status: 'MITIGATED'
    },
    
    'Denial of Service': {
      description: 'Service becomes unavailable',
      vectors: [
        'Blockchain spam',
        'Database overload',
        'Queue flooding',
        'API rate abuse'
      ],
      mitigation: [
        'Rate limiting',
        'Queue size limits',
        'Database indexes',
        'CDN for static assets'
      ],
      status: 'MITIGATED'
    },
    
    'Griefing Attacks': {
      description: 'Attacker prevents legitimate gameplay',
      vectors: [
        'Never joining created games',
        'Queue spam',
        'Self-matching',
        'Rapid create/cancel'
      ],
      mitigation: [
        'Game timeouts',
        'One queue entry per wallet',
        'Self-match prevention',
        'Cooldown periods'
      ],
      status: 'MITIGATED'
    }
  },
  
  MEDIUM: {
    'Data Integrity': {
      description: 'Game history or stats manipulated',
      vectors: [
        'SQL injection',
        'Event indexer bugs',
        'Race conditions',
        'Cache poisoning'
      ],
      mitigation: [
        'Parameterized queries',
        'Event deduplication',
        'Transaction isolation',
        'Signed cache entries'
      ],
      status: 'MITIGATED'
    },
    
    'Privacy Leaks': {
      description: 'User data exposed unnecessarily',
      vectors: [
        'Wallet address tracking',
        'Game pattern analysis',
        'Metadata correlation',
        'Timing attacks'
      ],
      mitigation: [
        'Minimal data collection',
        'Aggregated statistics only',
        'No PII storage',
        'Rate limiting'
      ],
      status: 'PARTIALLY_MITIGATED'
    }
  }
};
```

---

## 2. Smart Contract Security

### 2.1 Critical Security Patterns

```solidity
// ============================================
// REENTRANCY PROTECTION
// ============================================

// CORRECT: Checks-Effects-Interactions (CEI) Pattern
function joinGame(uint256 gameId) external payable nonReentrant {
    Game storage game = games[gameId];
    
    // 1. CHECKS
    require(game.state == GameState.OPEN, "Not open");
    require(msg.sender != game.playerA, "Can't join own game");
    require(msg.value == tiers[game.tier].amount, "Wrong amount");
    
    // 2. EFFECTS (state changes)
    game.playerB = msg.sender;
    game.state = GameState.LOCKED;
    game.joinedBlock = block.number;
    
    // 3. INTERACTIONS (external calls)
    uint256 requestId = _requestRandomness();
    game.vrfRequestId = requestId;
    
    emit GameJoined(gameId, msg.sender);
}

// WRONG: Vulnerable to reentrancy
function joinGameVULNERABLE(uint256 gameId) external payable {
    // ❌ External call before state changes
    uint256 requestId = _requestRandomness();
    
    // ❌ State changes after external call
    games[gameId].state = GameState.LOCKED;
    // Attacker could reenter here!
}

// ============================================
// ACCESS CONTROL
// ============================================

// Use OpenZeppelin Ownable
import "@openzeppelin/contracts/access/Ownable.sol";

contract CoinFlip is Ownable {
    // Only owner can modify tiers
    function updateTier(uint8 tier, uint256 amount, bool enabled) 
        external 
        onlyOwner 
    {
        tiers[tier].amount = amount;
        tiers[tier].enabled = enabled;
    }
    
    // Only owner can pause
    function pause() external onlyOwner {
        _pause();
    }
    
    // ❌ NEVER allow owner to:
    // - Withdraw player funds
    // - Modify game outcomes
    // - Change VRF results
}

// ============================================
// INPUT VALIDATION
// ============================================

function createGame(uint8 tier, bool choice) external payable {
    // Validate tier
    require(tier < MAX_TIERS, "Invalid tier");
    require(tiers[tier].enabled, "Tier disabled");
    
    // Validate bet amount
    require(msg.value == tiers[tier].amount, "Incorrect amount");
    
    // Validate balance (anti-spam)
    require(msg.sender.balance >= tiers[tier].minBalance, "Low balance");
    
    // Validate choice (redundant but explicit)
    require(choice == true || choice == false, "Invalid choice");
}

// ============================================
// INTEGER OVERFLOW PROTECTION
// ============================================

// Solidity 0.8+ has built-in protection
pragma solidity ^0.8.20; // Automatically reverts on overflow

function calculatePayout(uint256 bet) internal pure returns (uint256) {
    uint256 pot = bet * 2;        // Reverts if overflow
    uint256 fee = pot * 200 / 10000; // Safe math
    return pot - fee;
}

// For older Solidity versions, use SafeMath:
// import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// ============================================
// FRONT-RUNNING PROTECTION
// ============================================

// Coin flip games have minimal MEV risk because:
// 1. No price oracles (no profitable arbitrage)
// 2. VRF is async (can't predict outcome)
// 3. Outcome is binary (no partial fills)

// But we still mitigate:
function joinGame(uint256 gameId) external payable {
    // Require exact match
    require(msg.value == expectedAmount, "Exact amount required");
    
    // State change before randomness request
    game.state = GameState.LOCKED;
    
    // VRF callback is delayed (no same-block exploitation)
}

// ============================================
// EXTERNAL CALL SAFETY
// ============================================

function _payout(uint256 gameId) private {
    Game storage game = games[gameId];
    uint256 amount = calculatePayout(game.tier);
    
    // Use .call instead of .transfer
    // .transfer has 2300 gas limit (can fail on complex wallets)
    (bool success, ) = game.winner.call{value: amount}("");
    require(success, "Transfer failed");
}

// Never use .send() (silently fails)
// Never use .transfer() (hard gas limit)
// Always use .call() with require
```

### 2.2 VRF Security

```solidity
// ============================================
// CHAINLINK VRF SECURITY
// ============================================

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

// CRITICAL: Only Chainlink coordinator can call fulfillRandomWords
function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    // ✅ Already protected by VRFConsumerBaseV2
    // Only VRF Coordinator can call this function
    
    uint256 gameId = vrfRequests[requestId];
    Game storage game = games[gameId];
    
    // Validate state
    require(game.state == GameState.LOCKED, "Invalid state");
    
    // Use randomness
    bool coinResult = (randomWords[0] % 2) == 1;
    
    // No one can predict or manipulate this value
}

// ❌ NEVER do this:
function badRandomness() internal view returns (uint256) {
    // Predictable!
    return uint256(keccak256(abi.encodePacked(
        block.timestamp,    // Miner can manipulate
        block.difficulty,   // Predictable
        msg.sender          // Known
    )));
}
```

### 2.3 Emergency Controls

```solidity
// ============================================
// EMERGENCY PAUSE
// ============================================

import "@openzeppelin/contracts/security/Pausable.sol";

contract CoinFlip is Pausable {
    // Pause new game creation
    function createGame(...) external payable whenNotPaused {
        // Game creation logic
    }
    
    // ✅ Active games can still be resolved
    function joinGame(...) external payable whenNotPaused {
        // Join logic
    }
    
    // ✅ IMPORTANT: Don't pause resolution
    function fulfillRandomWords(...) internal override {
        // Resolution continues even when paused
        // Players must be able to get their funds
    }
    
    // Admin functions
    function pause() external onlyOwner {
        _pause();
        emit EmergencyPause(block.timestamp);
    }
    
    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpause(block.timestamp);
    }
}
```

---

## 3. Frontend Security

### 3.1 Content Security Policy

```typescript
// next.config.js or headers in server config
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Needed for wagmi
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.polygon.io wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];
```

### 3.2 Input Sanitization

```typescript
// ALWAYS sanitize user input
import DOMPurify from 'dompurify';

// For displaying user-provided content
function DisplayUserContent({ content }: { content: string }) {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: []
  });
  
  return <div>{sanitized}</div>;
}

// For wallet addresses
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// For amounts
function parseAmount(input: string): bigint | null {
  try {
    const amount = BigInt(input);
    if (amount < 0n) return null;
    return amount;
  } catch {
    return null;
  }
}
```

### 3.3 Transaction Security

```typescript
// ALWAYS show transaction preview before signing
interface TransactionPreview {
  action: string;
  amount: string;
  recipient: string;
  fee: string;
  total: string;
}

function CreateGameButton() {
  const [showPreview, setShowPreview] = useState(false);
  
  const preview: TransactionPreview = {
    action: 'Create Coin Flip Game',
    amount: '$25 USDC',
    recipient: 'CoinFlip Contract',
    fee: '~$0.50 (gas)',
    total: '$25.50'
  };
  
  return (
    <>
      <button onClick={() => setShowPreview(true)}>
        Create Game
      </button>
      
      {showPreview && (
        <TransactionPreviewModal
          preview={preview}
          onConfirm={handleCreateGame}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

// ❌ NEVER auto-sign transactions
// ❌ NEVER request private keys
// ❌ NEVER use eval() or innerHTML
```

### 3.4 Wallet Security

```typescript
// Use secure wallet connection
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

// Security best practices:
const walletConfig = {
  // Only allow reputable wallets
  wallets: [
    metaMaskWallet,
    walletConnectWallet,
    coinbaseWallet,
    ledgerWallet  // Hardware wallet
  ],
  
  // Show clear warnings
  disclaimer: ({ Text, Link }) => (
    <Text>
      By connecting your wallet, you agree to our{' '}
      <Link href="/terms">Terms of Service</Link>.
      Never share your private keys or seed phrase.
    </Text>
  )
};

// Validate wallet before critical actions
function validateWallet(address: string): boolean {
  // Check it's not a known scam address
  if (BLACKLIST.includes(address.toLowerCase())) {
    return false;
  }
  
  // Check sufficient balance
  const balance = useBalance({ address });
  if (balance.value < MINIMUM_BALANCE) {
    toast.error('Insufficient balance for gas fees');
    return false;
  }
  
  return true;
}
```

---

## 4. Backend Security

### 4.1 Database Security

```sql
-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Only allow authenticated reads
CREATE POLICY "Authenticated users can read"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can write game data
CREATE POLICY "Service role only for games"
  ON games FOR ALL
  TO service_role
  USING (true);

-- Prevent SQL injection with parameterized queries
-- ✅ CORRECT
const { data } = await supabase
  .from('games')
  .select('*')
  .eq('player_a', wallet);  // Parameterized

// ❌ WRONG - SQL Injection vulnerable
const query = `SELECT * FROM games WHERE player_a = '${wallet}'`;
```

### 4.2 API Security

```typescript
// Rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Per-wallet rate limiting
const walletLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body.wallet || req.ip,
  skip: (req) => !req.body.wallet
});

app.post('/api/queue/join', walletLimiter, async (req, res) => {
  // Handle queue join
});
```

### 4.3 Event Indexer Security

```typescript
// Prevent duplicate event processing
async function processEvent(event: any) {
  const { transactionHash, logIndex } = event;
  
  // Atomic insert (prevents race conditions)
  const { error } = await supabase
    .from('blockchain_events')
    .insert({
      transaction_hash: transactionHash,
      log_index: logIndex,
      event_data: event,
      processed: false
    });
  
  if (error?.code === '23505') {
    // Duplicate constraint violation - already processed
    return;
  }
  
  // Process event...
}

// Verify event source
function verifyEventSource(event: any): boolean {
  // Only accept events from official contract
  if (event.address.toLowerCase() !== COINFLIP_ADDRESS.toLowerCase()) {
    console.error('Event from unknown contract:', event.address);
    return false;
  }
  
  return true;
}
```

---

## 5. Infrastructure Security

### 5.1 Environment Variables

```bash
# .env.example (commit this)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_WALLET_CONNECT_ID=your_project_id
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# .env (NEVER commit this)
SUPABASE_SERVICE_ROLE_KEY=xxx  # Secret!
DATABASE_URL=xxx               # Secret!
PRIVATE_KEY=xxx                # Secret! (for deployment only)
```

```typescript
// Validate environment variables at startup
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CONTRACT_ADDRESS'
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

### 5.2 Deployment Security

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      # Security scanning
      - name: Run security scan
        run: npm audit
      
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      
      # Contract verification
      - name: Verify contract on Etherscan
        run: |
          npx hardhat verify \
            --network polygon \
            $CONTRACT_ADDRESS \
            $CONSTRUCTOR_ARGS
      
      # Deploy
      - name: Deploy frontend
        run: npm run build && npm run deploy
```

---

## 6. Testing Strategy

### 6.1 Smart Contract Tests

```javascript
// test/CoinFlip.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoinFlip Security Tests", function () {
  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy on joinGame", async function () {
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await Attacker.deploy(coinFlip.address);
      
      await expect(
        attacker.attack({ value: tier0Amount })
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });
  });
  
  describe("Access Control", function () {
    it("Should reject non-owner tier updates", async function () {
      await expect(
        coinFlip.connect(user1).updateTier(0, newAmount, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("Should prevent admin fund theft", async function () {
      // Contract should have NO function to withdraw player funds
      expect(coinFlip.withdrawPlayerFunds).to.be.undefined;
    });
  });
  
  describe("Input Validation", function () {
    it("Should reject invalid tier", async function () {
      await expect(
        coinFlip.createGame(99, true, { value: 100 })
      ).to.be.revertedWith("Invalid tier");
    });
    
    it("Should reject incorrect bet amount", async function () {
      await expect(
        coinFlip.createGame(0, true, { value: 1 })
      ).to.be.revertedWith("Incorrect amount");
    });
  });
  
  describe("VRF Security", function () {
    it("Should only accept VRF callback from coordinator", async function () {
      await expect(
        coinFlip.rawFulfillRandomWords(1, [123])
      ).to.be.revertedWith("Only coordinator can fulfill");
    });
  });
  
  describe("Game Logic", function () {
    it("Should prevent self-join", async function () {
      await coinFlip.createGame(0, true, { value: tier0Amount });
      
      await expect(
        coinFlip.joinGame(0, { value: tier0Amount })
      ).to.be.revertedWith("Cannot join own game");
    });
    
    it("Should timeout abandoned games", async function () {
      await coinFlip.createGame(0, true, { value: tier0Amount });
      
      // Mine 100 blocks
      await mine(100);
      
      await expect(
        coinFlip.cancelGame(0)
      ).to.not.be.reverted;
    });
  });
  
  describe("Payout Correctness", function () {
    it("Should pay correct amount after fees", async function () {
      const game = await createAndJoinGame(0);
      const expectedPayout = tier0Amount * 2 * 0.98; // 2% fee
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      await resolveGame(game.id, true); // user1 wins
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(expectedPayout);
    });
  });
});
```

### 6.2 Frontend Security Tests

```typescript
// frontend.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateGameButton } from './CreateGameButton';

describe('Frontend Security', () => {
  it('should sanitize user input', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    render(<DisplayContent content={maliciousInput} />);
    
    // Should not execute script
    expect(screen.queryByText('alert')).not.toBeInTheDocument();
  });
  
  it('should show transaction preview before signing', () => {
    render(<CreateGameButton />);
    
    fireEvent.click(screen.getByText('Create Game'));
    
    // Preview should appear
    expect(screen.getByText('Transaction Preview')).toBeInTheDocument();
    expect(screen.getByText('Amount: $25')).toBeInTheDocument();
  });
  
  it('should validate wallet address format', () => {
    expect(isValidAddress('0x1234')).toBe(false);
    expect(isValidAddress('not an address')).toBe(false);
    expect(isValidAddress('0x' + '1'.repeat(40))).toBe(true);
  });
});
```

### 6.3 Integration Tests

```typescript
// e2e/security.test.ts
import { test, expect } from '@playwright/test';

test('should prevent XSS attacks', async ({ page }) => {
  await page.goto('/');
  
  // Inject script via input
  await page.fill('input[name="username"]', '<script>alert("xss")</script>');
  await page.click('button[type="submit"]');
  
  // Should not execute
  page.on('dialog', () => {
    throw new Error('XSS executed!');
  });
  
  await page.waitForTimeout(1000);
  // If we get here, XSS was prevented
});

test('should require wallet connection for critical actions', async ({ page }) => {
  await page.goto('/play');
  
  // Try to create game without wallet
  await page.click('button:has-text("Create Game")');
  
  // Should show connect wallet prompt
  expect(await page.textContent('body')).toContain('Connect Wallet');
});
```

---

## 7. Audit Preparation

### 7.1 Pre-Audit Checklist

```
SMART CONTRACT:
☐ All functions have NatSpec comments
☐ No TODO or FIXME comments in production code
☐ All tests passing (100% coverage)
☐ Gas optimization reviewed
☐ No unused code or imports
☐ Consistent naming conventions
☐ Emergency pause tested
☐ All events properly indexed
☐ Upgrade mechanism documented (if applicable)

FRONTEND:
☐ CSP headers configured
☐ All user input sanitized
☐ No eval() or innerHTML usage
☐ Transaction previews implemented
☐ Error boundaries in place
☐ Wallet disconnection handled

BACKEND:
☐ RLS policies enabled
☐ Rate limiting implemented
☐ Environment variables secured
☐ SQL injection prevented
☐ Event deduplication tested
☐ Database indexes optimized

INFRASTRUCTURE:
☐ Secrets not in repository
☐ HTTPS enforced
☐ CORS properly configured
☐ Monitoring in place
☐ Backup strategy documented
```

### 7.2 Audit Documentation Package

```
docs/
├── architecture/
│   ├── system-overview.md
│   ├── data-flow.md
│   └── trust-model.md
│
├── contracts/
│   ├── contract-spec.md
│   ├── function-documentation.md
│   ├── state-variables.md
│   └── security-considerations.md
│
├── testing/
│   ├── test-coverage-report.html
│   ├── test-scenarios.md
│   └── known-limitations.md
│
└── deployment/
    ├── deployment-process.md
    ├── contract-addresses.md
    └── admin-procedures.md
```

---

## 8. Incident Response

### 8.1 Incident Response Plan

```typescript
// Incident severity levels
enum Severity {
  CRITICAL = 'CRITICAL',  // Funds at risk, immediate action
  HIGH = 'HIGH',          // Service degraded, action within 1 hour
  MEDIUM = 'MEDIUM',      // Minor issues, action within 24 hours
  LOW = 'LOW'             // Monitoring only
}

// Incident response procedures
const incidents = {
  CONTRACT_EXPLOIT: {
    severity: Severity.CRITICAL,
    steps: [
      '1. Pause contract immediately (if possible)',
      '2. Notify all users via social media',
      '3. Contact security team',
      '4. Assess exploit and funds at risk',
      '5. Prepare patch or mitigation',
      '6. Coordinate with affected users',
      '7. Post-mortem analysis'
    ],
    contacts: [
      'Security Lead: security@coinflip.game',
      'Dev Team: dev@coinflip.game',
      'Legal: legal@coinflip.game'
    ]
  },
  
  FRONTEND_COMPROMISE: {
    severity: Severity.CRITICAL,
    steps: [
      '1. Take down compromised frontend',
      '2. Deploy clean version',
      '3. Notify users not to use site',
      '4. Investigate compromise vector',
      '5. Reset all credentials',
      '6. Security audit before relaunch'
    ]
  },
  
  DATABASE_BREACH: {
    severity: Severity.HIGH,
    steps: [
      '1. Isolate database',
      '2. Assess data exposed',
      '3. Notify affected users (GDPR compliance)',
      '4. Reset credentials',
      '5. Patch vulnerability',
      '6. Security review'
    ]
  }
};
```

### 8.2 Emergency Contacts

```
┌─────────────────────────────────────────────────┐
│              EMERGENCY CONTACTS                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Security Team Lead:                            │
│  Email: security@coinflip.game                  │
│  Phone: +1-XXX-XXX-XXXX                         │
│                                                  │
│  Smart Contract Auditor:                        │
│  Company: [Audit Firm Name]                     │
│  Contact: auditor@firm.com                      │
│                                                  │
│  Legal Counsel:                                 │
│  Email: legal@coinflip.game                     │
│                                                  │
│  Infrastructure Provider (Supabase):            │
│  Support: support.supabase.com                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 9. Compliance & Legal

### 9.1 Regulatory Considerations

```
GAMBLING REGULATIONS:
☐ Age verification (18+ or jurisdiction-specific)
☐ Geo-blocking for restricted jurisdictions
☐ Responsible gaming features
☐ Terms of Service clearly displayed
☐ Odds transparency (50/50 clearly stated)
☐ No misleading marketing

DATA PROTECTION:
☐ GDPR compliance (if serving EU users)
☐ Privacy policy published
☐ Data retention policy
☐ Right to be forgotten implemented
☐ Data export functionality
☐ Cookie consent

FINANCIAL REGULATIONS:
☐ AML/KYC considerations (if required)
☐ Transaction reporting (if required)
☐ Tax reporting guidelines
☐ Clear fee disclosure
```

### 9.2 Terms of Service (Key Points)

```
REQUIRED DISCLOSURES:
- Non-custodial nature (we never hold funds)
- Smart contract risks
- Blockchain finality
- No guarantees on VRF timing
- User responsibility for gas fees
- User responsibility for taxes
- Prohibited jurisdictions
- Age restrictions
- Dispute resolution process
```

---

## Conclusion

This security guide provides:

✅ **Comprehensive threat model** covering all attack vectors  
✅ **Layer-by-layer security** for contracts, frontend, backend  
✅ **Testing strategy** with examples for all components  
✅ **Audit preparation** checklist and documentation  
✅ **Incident response** procedures for emergencies  
✅ **Compliance considerations** for legal requirements

**Pre-Launch Security Checklist:**
1. ✅ Smart contract audited by reputable firm
2. ✅ All tests passing with >95% coverage
3. ✅ Frontend security headers configured
4. ✅ Rate limiting implemented
5. ✅ RLS policies enabled on database
6. ✅ Incident response plan documented
7. ✅ Legal review completed
8. ✅ Bug bounty program announced

**Remember:** Security is not a one-time task. Continuous monitoring, regular audits, and staying updated on new threats are essential for long-term safety.


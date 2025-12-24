# Deployment & Operations Guide
## Complete Production Deployment and Maintenance Procedures

---

## Document Purpose

This document provides everything needed to deploy and operate the application in production:
- Complete deployment procedures for all components
- CI/CD pipeline configuration
- Monitoring and observability setup
- Operational runbooks
- Scaling strategies
- Maintenance procedures

---

## Table of Contents

1. [Deployment Overview](#1-deployment-overview)
2. [Smart Contract Deployment](#2-smart-contract-deployment)
3. [Frontend Deployment](#3-frontend-deployment)
4. [Backend Deployment](#4-backend-deployment)
5. [Event Indexer Deployment](#5-event-indexer-deployment)
6. [CI/CD Pipeline](#6-cicd-pipeline)
7. [Monitoring & Observability](#7-monitoring--observability)
8. [Operational Runbooks](#8-operational-runbooks)
9. [Scaling & Performance](#9-scaling--performance)
10. [Disaster Recovery](#10-disaster-recovery)

---

## 1. Deployment Overview

### 1.1 Infrastructure Architecture

```
PRODUCTION INFRASTRUCTURE
┌─────────────────────────────────────────────────┐
│                   USERS                         │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│               CLOUDFLARE CDN                    │
│  (DDoS protection, caching, SSL)               │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│            FRONTEND (Vercel)                    │
│  - Next.js app                                 │
│  - Static assets on CDN                        │
│  - Edge functions                              │
└────────────────┬────────────────────────────────┘
                 │
          ┌──────┴──────┐
          │             │
          ↓             ↓
┌─────────────┐  ┌─────────────────────────┐
│  SUPABASE   │  │    BLOCKCHAIN           │
│  - Database │  │  - Smart Contract       │
│  - Auth     │  │  - Polygon/Base Node    │
│  - Real-time│  │  - Chainlink VRF        │
└─────────────┘  └──────────┬──────────────┘
                            │
                            ↓
                 ┌─────────────────────┐
                 │  EVENT INDEXER      │
                 │  (Railway/Render)   │
                 └─────────────────────┘
```

### 1.2 Deployment Sequence

```
CORRECT DEPLOYMENT ORDER:

1. Deploy Smart Contract to testnet
   ↓
2. Verify contract on block explorer
   ↓
3. Create & fund VRF subscription
   ↓
4. Deploy Database (Supabase)
   ↓
5. Deploy Event Indexer (testnet)
   ↓
6. Test end-to-end on testnet
   ↓
7. Security audit
   ↓
8. Deploy Smart Contract to mainnet
   ↓
9. Deploy Database to production
   ↓
10. Deploy Event Indexer to production
    ↓
11. Deploy Frontend to production
    ↓
12. Monitor for 24-48 hours
    ↓
13. Announce public launch
```

---

## 2. Smart Contract Deployment

### 2.1 Pre-Deployment Checklist

```
☐ All tests passing (100% coverage)
☐ Security audit completed
☐ Gas optimization reviewed
☐ Contract verified on testnet
☐ VRF subscription created and funded
☐ Multisig wallet set up for ownership
☐ Fee recipient address confirmed
☐ Initial tier configuration finalized
☐ Emergency procedures documented
```

### 2.2 Deployment Script (Hardhat)

```javascript
// scripts/deploy-production.js
const { ethers } = require("hardhat");
const fs = require("fs");

// Network-specific configuration
const NETWORKS = {
  polygon: {
    vrfCoordinator: "0xAE975071Be8F8eE67addBC1A82488F1C24858067",
    keyHash: "0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd",
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID,
    feeRecipient: process.env.FEE_RECIPIENT_ADDRESS, // Multisig
    confirmations: 6
  },
  mumbai: {
    vrfCoordinator: "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed",
    keyHash: "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f",
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID_TESTNET,
    feeRecipient: process.env.DEPLOYER_ADDRESS,
    confirmations: 2
  }
};

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;
  
  console.log(`Deploying to ${networkName}...`);
  
  const config = NETWORKS[networkName];
  if (!config) {
    throw new Error(`Network ${networkName} not supported`);
  }
  
  // Validate configuration
  if (!config.subscriptionId) {
    throw new Error("VRF_SUBSCRIPTION_ID not set");
  }
  if (!config.feeRecipient) {
    throw new Error("FEE_RECIPIENT_ADDRESS not set");
  }
  
  // Deploy contract
  const CoinFlip = await ethers.getContractFactory("CoinFlip");
  const coinFlip = await CoinFlip.deploy(
    config.subscriptionId,
    config.vrfCoordinator,
    config.keyHash,
    config.feeRecipient
  );
  
  console.log("Deploying contract...");
  await coinFlip.deployed();
  
  console.log(`✅ CoinFlip deployed to: ${coinFlip.address}`);
  
  // Wait for confirmations
  console.log(`Waiting for ${config.confirmations} confirmations...`);
  await coinFlip.deployTransaction.wait(config.confirmations);
  
  // Verify on Etherscan/Polygonscan
  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: coinFlip.address,
      constructorArguments: [
        config.subscriptionId,
        config.vrfCoordinator,
        config.keyHash,
        config.feeRecipient
      ]
    });
    console.log("✅ Contract verified");
  } catch (error) {
    console.error("Verification failed:", error.message);
  }
  
  // Save deployment info
  const deployment = {
    network: networkName,
    address: coinFlip.address,
    deployer: (await ethers.getSigners())[0].address,
    timestamp: new Date().toISOString(),
    txHash: coinFlip.deployTransaction.hash,
    blockNumber: coinFlip.deployTransaction.blockNumber,
    config: {
      vrfSubscriptionId: config.subscriptionId,
      feeRecipient: config.feeRecipient
    }
  };
  
  fs.writeFileSync(
    `deployments/${networkName}-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("\n📋 Next steps:");
  console.log(`1. Add ${coinFlip.address} to your VRF subscription`);
  console.log(`2. Transfer ownership to multisig: ${config.feeRecipient}`);
  console.log(`3. Update frontend config with contract address`);
  console.log(`4. Update event indexer with contract address`);
  console.log(`5. Monitor first transactions carefully\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 2.3 Post-Deployment Steps

```bash
# 1. Add contract to VRF subscription (Chainlink dashboard)
# Visit: https://vrf.chain.link/polygon

# 2. Transfer ownership to multisig
npx hardhat run scripts/transfer-ownership.js --network polygon

# 3. Verify contract is working
npx hardhat run scripts/test-deployment.js --network polygon

# 4. Monitor first games
npx hardhat run scripts/monitor-events.js --network polygon
```

---

## 3. Frontend Deployment

### 3.1 Vercel Deployment

```yaml
# vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "NEXT_PUBLIC_CONTRACT_ADDRESS": "@contract-address",
    "NEXT_PUBLIC_CHAIN_ID": "137",
    "NEXT_PUBLIC_WALLET_CONNECT_ID": "@wallet-connect-id"
  },
  
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ],
  
  "redirects": [
    {
      "source": "/home",
      "destination": "/",
      "permanent": true
    }
  ]
}
```

### 3.2 Build Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Performance optimization
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  
  // Image optimization
  images: {
    domains: ['supabase.co'],
    formats: ['image/avif', 'image/webp']
  },
  
  // Bundle analysis
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false
      };
    }
    return config;
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID
  }
};

module.exports = nextConfig;
```

### 3.3 Deployment Script

```bash
#!/bin/bash
# deploy-frontend.sh

echo "🚀 Deploying CoinFlip Frontend"

# 1. Run tests
echo "Running tests..."
npm test

if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Aborting deployment."
  exit 1
fi

# 2. Type check
echo "Type checking..."
npm run type-check

if [ $? -ne 0 ]; then
  echo "❌ Type errors found. Aborting deployment."
  exit 1
fi

# 3. Lint
echo "Linting..."
npm run lint

if [ $? -ne 0 ]; then
  echo "❌ Lint errors found. Aborting deployment."
  exit 1
fi

# 4. Build
echo "Building..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting deployment."
  exit 1
fi

# 5. Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
```

---

## 4. Backend Deployment

### 4.1 Supabase Setup

```sql
-- migrations/001_initial_schema.sql
-- Run this in Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create tables (from database schema doc)
-- [Include full schema from 03_backend_database_architecture.md]

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

-- Create policies
-- [Include all RLS policies]

-- Create indexes
-- [Include all indexes]

-- Create functions and triggers
-- [Include all functions]
```

### 4.2 Supabase Configuration

```typescript
// supabase/config.toml
[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
major_version = 15

[storage]
file_size_limit = "50MiB"

[auth]
site_url = "https://coinflip.game"
additional_redirect_urls = ["http://localhost:3000"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = false  # Wallet-only auth

[auth.external.google]
enabled = false

[realtime]
enabled = true
```

### 4.3 Environment Setup

```bash
# Production environment variables
# Add these in Supabase Dashboard > Settings > API

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Keep secret!

# Contract configuration
CONTRACT_ADDRESS=0x...
CHAIN_ID=137
START_BLOCK=12345678
```

---

## 5. Event Indexer Deployment

### 5.1 Railway Deployment

```yaml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
NODE_ENV = "production"
```

### 5.2 Indexer Configuration

```typescript
// indexer/config.ts
export const config = {
  // Blockchain
  rpcUrl: process.env.RPC_URL!,
  contractAddress: process.env.CONTRACT_ADDRESS!,
  startBlock: parseInt(process.env.START_BLOCK || '0'),
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  
  // Performance
  batchSize: 1000,        // Process 1000 blocks at a time
  pollingInterval: 5000,  // Poll every 5 seconds
  confirmations: 6,       // Wait for 6 confirmations
  
  // Error handling
  maxRetries: 3,
  retryDelay: 1000,
  
  // Health check
  healthCheckPort: 3000
};

// Validate configuration
Object.entries(config).forEach(([key, value]) => {
  if (value === undefined || value === '') {
    throw new Error(`Missing required config: ${key}`);
  }
});
```

### 5.3 Health Check Endpoint

```typescript
// indexer/server.ts
import express from 'express';

const app = express();
let lastProcessedBlock = 0;
let isHealthy = true;

app.get('/health', (req, res) => {
  const currentTime = Date.now();
  const timeSinceLastBlock = currentTime - lastBlockTimestamp;
  
  // Unhealthy if no blocks processed in 5 minutes
  if (timeSinceLastBlock > 5 * 60 * 1000) {
    isHealthy = false;
  }
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    lastProcessedBlock,
    lastBlockTimestamp,
    timeSinceLastBlock,
    uptime: process.uptime()
  });
});

app.listen(config.healthCheckPort, () => {
  console.log(`Health check server running on port ${config.healthCheckPort}`);
});
```

---

## 6. CI/CD Pipeline

### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run tests
        run: npm test
      
      - name: Run security audit
        run: npm audit --audit-level=high
  
  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
  
  deploy-indexer:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up --service indexer
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 7. Monitoring & Observability

### 7.1 Monitoring Stack

```
MONITORING SETUP:
├── Vercel Analytics (Frontend)
│   ├── Page views
│   ├── Load times
│   └── User geography
│
├── Supabase Dashboard (Backend)
│   ├── Database performance
│   ├── API usage
│   └── Real-time connections
│
├── Alchemy/Infura Dashboard (Blockchain)
│   ├── RPC call volume
│   ├── Gas usage
│   └── Contract events
│
└── Railway Logs (Indexer)
    ├── Event processing
    ├── Error rates
    └── Uptime
```

### 7.2 Key Metrics

```typescript
// metrics/index.ts
export const metrics = {
  // Business metrics
  business: {
    dailyActiveWallets: 'COUNT DISTINCT wallet FROM games WHERE DATE = TODAY',
    gamesPerDay: 'COUNT * FROM games WHERE DATE = TODAY',
    volumePerDay: 'SUM bet_amount * 2 FROM games WHERE DATE = TODAY',
    averageGameDuration: 'AVG(resolved_at - created_at)',
    queueWaitTime: 'AVG(matched_at - joined_at) FROM queues'
  },
  
  // Technical metrics
  technical: {
    frontendLoadTime: 'P95 page load time',
    apiResponseTime: 'P95 API response time',
    databaseQueryTime: 'P95 query execution time',
    indexerLag: 'current_block - last_indexed_block',
    errorRate: 'failed_requests / total_requests'
  },
  
  // Contract metrics
  contract: {
    gasUsedPerGame: 'AVG gas_used FROM transactions',
    vrfResponseTime: 'AVG(resolved_at - joined_at)',
    contractBalance: 'ETH balance in contract',
    feesCollected: 'SUM fees FROM games'
  }
};
```

### 7.3 Alerting Rules

```yaml
# alerting.yml
alerts:
  - name: High Error Rate
    condition: error_rate > 0.05
    severity: critical
    notification: slack, email
    
  - name: Indexer Lag
    condition: indexer_lag > 100
    severity: high
    notification: slack
    
  - name: Low Contract Balance
    condition: contract_balance < 1 ETH
    severity: medium
    notification: email
    
  - name: Slow VRF Response
    condition: vrf_response_time > 60s
    severity: medium
    notification: slack
```

---

## 8. Operational Runbooks

### 8.1 Emergency Pause Procedure

```bash
# runbooks/emergency-pause.sh
#!/bin/bash
# Use when critical vulnerability discovered

echo "🚨 EMERGENCY PAUSE PROCEDURE"
echo "This will pause new game creation."
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

# 1. Pause contract (multisig required)
echo "Initiating contract pause via multisig..."
npx hardhat run scripts/pause-contract.js --network polygon

# 2. Show maintenance page on frontend
echo "Deploying maintenance page..."
vercel --prod --env MAINTENANCE_MODE=true

# 3. Stop indexer
echo "Stopping event indexer..."
railway down indexer

# 4. Notify users
echo "Posting status update..."
# Post to Twitter, Discord, etc.

echo "✅ Emergency pause complete"
echo "Next steps:"
echo "1. Investigate issue"
echo "2. Prepare fix"
echo "3. Test on testnet"
echo "4. Deploy fix"
echo "5. Resume operations"
```

### 8.2 Database Backup Procedure

```bash
# runbooks/backup-database.sh
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

# Backup using Supabase CLI
supabase db dump -f "$BACKUP_DIR/schema.sql"

# Backup data
supabase db dump --data-only -f "$BACKUP_DIR/data.sql"

# Upload to S3
aws s3 cp "$BACKUP_DIR" "s3://coinflip-backups/${TIMESTAMP}" --recursive

echo "✅ Backup complete: $BACKUP_DIR"
```

### 8.3 Scaling Runbook

```bash
# runbooks/scale-up.sh
#!/bin/bash
# Use when experiencing high load

echo "📈 SCALING UP INFRASTRUCTURE"

# 1. Upgrade Supabase plan if needed
echo "Check Supabase dashboard for connection limits"

# 2. Scale indexer
railway scale indexer --replicas 3

# 3. Enable Vercel Edge Functions caching
echo "Enable aggressive caching on Vercel"

# 4. Increase RPC rate limits
echo "Upgrade Alchemy/Infura plan if needed"

echo "✅ Scaling complete"
```

---

## 9. Scaling & Performance

### 9.1 Performance Targets

```
TARGET METRICS:
├── Frontend
│   ├── First Contentful Paint: <1.5s
│   ├── Time to Interactive: <3s
│   └── Lighthouse Score: >90
│
├── Backend
│   ├── API Response Time: <200ms (P95)
│   ├── Database Query Time: <50ms (P95)
│   └── Real-time Message Delay: <500ms
│
└── Smart Contract
    ├── Gas per Game: <0.01 ETH
    ├── VRF Response: <15s (P95)
    └── Transaction Success Rate: >99%
```

### 9.2 Optimization Techniques

```typescript
// Frontend optimization
const optimizations = {
  codesplitting: 'Dynamic imports for routes',
  imageOptimization: 'Next.js Image component',
  bundleSize: 'Tree shaking + minification',
  caching: 'React Query + service worker',
  cdnUsage: 'Cloudflare for static assets'
};

// Backend optimization
const dbOptimizations = {
  indexes: 'All foreign keys and common queries',
  connectionPooling: 'Supabase handles this',
  queryOptimization: 'Use views for complex joins',
  caching: 'React Query on frontend'
};
```

---

## 10. Disaster Recovery

### 10.1 Recovery Plan

```
DISASTER SCENARIOS:

1. DATABASE FAILURE
   - RPO: 1 hour (hourly backups)
   - RTO: 2 hours
   - Procedure: Restore from S3 backup
   
2. CONTRACT EXPLOIT
   - RPO: N/A (blockchain is immutable)
   - RTO: Deploy new contract + migrate
   - Procedure: See incident response doc
   
3. FRONTEND COMPROMISE
   - RPO: N/A (stateless)
   - RTO: 1 hour
   - Procedure: Deploy clean version
   
4. INDEXER FAILURE
   - RPO: 0 (can replay from blockchain)
   - RTO: 30 minutes
   - Procedure: Restart from last known block
```

### 10.2 Backup Strategy

```
BACKUP SCHEDULE:
├── Database: Hourly incremental, daily full
├── Configuration: Version controlled in Git
├── Deployments: Tagged releases in GitHub
└── Logs: 30-day retention
```

---

## Conclusion

This deployment guide provides:

✅ **Complete deployment procedures** for all components  
✅ **CI/CD pipeline** for automated deployments  
✅ **Monitoring strategy** with key metrics  
✅ **Operational runbooks** for common scenarios  
✅ **Scaling strategies** for growth  
✅ **Disaster recovery** procedures

**Pre-Launch Deployment Checklist:**
1. ✅ All tests passing in CI/CD
2. ✅ Security audit completed
3. ✅ Testnet deployment validated
4. ✅ Monitoring configured
5. ✅ Backups automated
6. ✅ Runbooks documented
7. ✅ Team trained on procedures
8. ✅ Incident response plan reviewed

**Post-Launch:**
- Monitor closely for first 48 hours
- Be ready to pause if issues detected
- Collect user feedback
- Iterate based on real usage patterns


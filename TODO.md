# Project TODO

> This file tracks ongoing improvements, security recommendations, and technical debt.
> Updated: 2026-01-04

---

## Production Readiness Checklist

### CRITICAL - Must Complete Before Launch

- [ ] **Deploy Contract to Polygon Mainnet**
  - Run: `pnpm hardhat run scripts/deploy.ts --network polygon`
  - Update `NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON` in env
  - Verify contract on Polygonscan

- [ ] **Fund VRF Subscription with LINK**
  - Go to: https://vrf.chain.link
  - Create subscription on Polygon Mainnet
  - Fund with sufficient LINK (recommend 10+ LINK)
  - Add contract as consumer

- [ ] **Configure Chainlink Automation**
  - Register upkeep at: https://automation.chain.link
  - Set gas limit appropriately (~500,000)
  - Fund with LINK

- [ ] **Set up Production Supabase**
  - Create new Supabase project for production
  - Apply all 35 migrations
  - Verify RLS policies are active
  - Test realtime subscriptions

- [ ] **Deploy Supabase Edge Functions**
  - Deploy: `supabase functions deploy send-game-email`
  - Set secrets: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### HIGH - Required for Stable Launch

- [ ] **Configure Sentry Error Monitoring**
  - Create Sentry project
  - Set `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
  - Test error capturing

- [ ] **Set up Upstash Redis for Rate Limiting**
  - Create Upstash Redis database
  - Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Current fallback: in-memory rate limiting (not distributed)

- [ ] **Fix Hardcoded ETH Price**
  - Location: `lib/data/blockchain.ts:405`
  - Currently hardcoded: `$3000`
  - Integrate price oracle (CoinGecko API or Chainlink Price Feed)

- [ ] **Configure Email Service (Resend)**
  - Get API key from: https://resend.com
  - Set `RESEND_API_KEY` in Supabase Edge Function secrets
  - Verify email templates

- [ ] **Set up Production Indexer**
  - Deploy indexer as background service (PM2, systemd, or Docker)
  - Set `NODE_ENV=production`
  - Configure health monitoring

### MEDIUM - Recommended for Launch

- [ ] **Configure Domain & SSL**
  - Point domain to Vercel
  - Verify SSL certificate
  - Update `NEXT_PUBLIC_APP_URL`

- [ ] **Set up Vercel Analytics**
  - Enable in Vercel dashboard
  - Or set `NEXT_PUBLIC_GA_MEASUREMENT_ID` for Google Analytics

- [ ] **Verify Contract on Polygonscan**
  - Run: `pnpm hardhat verify --network polygon <address> <constructor args>`
  - Ensures transparency and trust

### LOW - Post-Launch Improvements

- [ ] **Increase Test Coverage to 80%+**
  - Current: 134 tests passing
  - Add more edge case tests

- [ ] **Add E2E Tests (Playwright)**
  - Test full user flows
  - Test wallet connection

- [ ] **Set up Staging Environment**
  - Mirror production config
  - Use Amoy testnet

---

## Security Recommendations

### High Priority

- [x] **Smart Contract: VRF call state updates analyzed**
  - Location: `contracts/CoinFlip.sol` - `joinGame()` function
  - Issue: State variables written after external VRF call (Slither warning)
  - Analysis: FALSE POSITIVE - `requestId` is only known after VRF call
  - Mitigations: `nonReentrant` modifier, game state locked before call, trusted VRF coordinator
  - Risk: LOW - not exploitable

### Medium Priority

- [x] **API Route: Rate limiting added**
  - In-memory rate limiting (100 req/min per IP)
  - Security headers configured
  - For production: upgrade to Redis-based solution (Upstash)

- [ ] **Dependency: Update transitive dependencies**
  - 8 vulnerabilities in dev deps (@chainlink, hardhat)
  - Dev dependencies only, not in production bundle

---

## Technical Debt

### Testing
- [ ] Increase test coverage to 80%+
- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests

### Infrastructure
- [x] Set up CI/CD pipeline (GitHub Actions) ✅
- [ ] Configure Sentry error monitoring
- [ ] Add Vercel Analytics
- [ ] Set up staging environment

### Code Quality
- [x] Removed unused dependencies ✅
- [x] Removed unused files (logger.ts, useSupabaseAuth.ts) ✅
- [ ] Add pre-commit hooks (Husky + lint-staged)

---

## Feature Backlog

### User Experience
- [x] Add email notifications ✅
- [ ] Add game history export (CSV)
- [ ] Add mobile layout improvements
- [ ] Add loading skeletons

### Smart Contract
- [ ] Add multi-game support
- [ ] Add referral system
- [ ] Consider L2 deployment (Arbitrum, Optimism)

### Admin
- [ ] Add admin dashboard
- [ ] Add game monitoring alerts

---

## Recently Completed

- [x] Add email notification system (Supabase Edge Functions)
- [x] Add email preference migrations (034, 035)
- [x] Clean up unused code and dependencies
- [x] Remove pino logger (unused)
- [x] Fix lint command
- [x] Theme consistency improvements
- [x] CI/CD pipeline configured

---

## Quick Reference

### Deployment Commands
```bash
# Deploy to testnet (Sepolia)
pnpm hardhat run scripts/deploy.ts --network sepolia

# Deploy to mainnet (Polygon)
pnpm hardhat run scripts/deploy.ts --network polygon

# Verify contract
pnpm hardhat verify --network polygon <address>

# Run indexer
NODE_ENV=production pnpm indexer
```

### Testing Commands
```bash
pnpm test                 # All tests
pnpm test:unit            # Unit tests
pnpm test:contracts       # Contract tests
pnpm test:coverage        # Coverage report
```

### Security Audit
```bash
pnpm audit:security       # Console output
pnpm audit:security:save  # Save report
```

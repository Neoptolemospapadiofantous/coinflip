# Project TODO

> This file tracks ongoing improvements, security recommendations, and technical debt.
> Updated: 2025-12-28

---

## Security Recommendations

### High Priority

- [x] **Smart Contract: VRF call state updates analyzed**
  - Location: `contracts/CoinFlip.sol` - `joinGame()` function
  - Issue: State variables written after external VRF call (Slither warning)
  - Analysis: This is a FALSE POSITIVE - `requestId` is only known after VRF call
  - Mitigations in place: (1) `nonReentrant` modifier, (2) game state set to LOCKED before call, (3) VRF coordinator is trusted Chainlink contract
  - Added documentation comment explaining the design decision
  - Risk: LOW - not exploitable

### Medium Priority

- [x] **API Route: Add rate limiting**
  - Location: `app/api/rpc/route.ts`
  - Issue: No rate limiting on RPC proxy endpoint
  - Fix: Added in-memory rate limiting (100 requests/minute per IP)
  - Also added: Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
  - Note: For distributed deployments, consider upgrading to Redis-based solution

- [ ] **Dependency: Update transitive dependencies**
  - Issue: 8 vulnerabilities in transitive deps (@chainlink, hardhat)
  - Fix: Add pnpm overrides or wait for upstream updates
  - Note: These are dev dependencies only, not affecting production

### Low Priority

- [ ] **Code Quality: Remove console.log statements**
  - Location: Various files in `app/`, `hooks/`, `lib/`
  - Issue: 31 console statements in production code
  - Fix: Remove or wrap in `if (process.env.NODE_ENV === 'development')`

- [ ] **ESLint: Fix remaining warnings**
  - Issue: 40 ESLint warnings (mostly unused vars and `any` types)
  - Fix: Clean up unused imports, add proper types

---

## Technical Debt

### Testing

- [ ] Increase test coverage to 80%+
- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests
- [ ] Add performance benchmarks

### Infrastructure

- [ ] Set up CI/CD pipeline with GitHub Actions
- [ ] Add Sentry error monitoring
- [ ] Add performance monitoring (Vercel Analytics)
- [ ] Set up staging environment

### Code Quality

- [ ] Add stricter TypeScript settings
- [ ] Add pre-commit hooks (Husky + lint-staged)
- [ ] Add commit message linting (Commitlint)
- [ ] Document all public APIs

---

## Feature Backlog

### User Experience

- [ ] Add game history export (CSV)
- [ ] Add sound preferences persistence
- [ ] Add mobile-optimized layout improvements
- [ ] Add loading skeletons for better perceived performance

### Smart Contract

- [ ] Add multi-game support (batch operations)
- [ ] Add referral system
- [ ] Consider L2 deployment (Arbitrum, Optimism)

### Admin

- [ ] Add admin dashboard with analytics
- [ ] Add game monitoring alerts
- [ ] Add automated VRF timeout claims

---

## Completed

- [x] Fix ALCHEMY_API_KEY exposure (moved to server-only)
- [x] Add wallet authentication to admin page
- [x] Add RPC proxy validation and timeouts
- [x] Fix memory leaks in hooks (mountedRef pattern)
- [x] Add ESLint v9 configuration
- [x] Create security audit system
- [x] Add error boundaries
- [x] Add database security hardening migration (RLS, audit triggers, indexes)
- [x] Add runtime game validation (parseGame, isValidGame)
- [x] Add input validation to useContract hooks
- [x] Allow immediate game cancellation (improved UX)
- [x] Remove hardcoded secrets from .env.example

---

## Notes

### Running Security Audit
```bash
pnpm audit:security           # Console output
pnpm audit:security:save      # Save markdown report
pnpm audit:security:json      # JSON for CI/CD
```

### Running Tests
```bash
pnpm test                     # Run all tests
pnpm test:unit                # Unit tests only
pnpm test:contracts           # Smart contract tests
pnpm test:coverage            # With coverage report
```

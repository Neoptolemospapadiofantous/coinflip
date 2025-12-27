# Project TODO

> This file tracks ongoing improvements, security recommendations, and technical debt.
> Updated: 2025-12-27

---

## Security Recommendations

### High Priority

- [ ] **Smart Contract: Reorder VRF call and state updates**
  - Location: `contracts/CoinFlip.sol` - `joinGame()` function
  - Issue: State variables written after external VRF call (potential reentrancy)
  - Fix: Move state updates before `requestRandomWords()` call
  - Detected by: Slither

### Medium Priority

- [ ] **API Route: Add rate limiting**
  - Location: `app/api/rpc/route.ts`
  - Issue: No rate limiting on RPC proxy endpoint
  - Fix: Add Upstash Ratelimit or similar
  - Example:
    ```typescript
    import { Ratelimit } from "@upstash/ratelimit";
    import { Redis } from "@upstash/redis";

    const ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "1 m"),
    });
    ```

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

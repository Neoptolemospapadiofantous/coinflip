# Security Policy

## Overview

This document outlines the security measures, best practices, and vulnerability reporting procedures for the CoinFlip application.

---

## 🔒 Security Architecture

### 1. Smart Contract Security

#### Implemented Security Features

**Access Control**
- ✅ OpenZeppelin `Ownable` for admin functions
- ✅ `Pausable` for emergency stop mechanism
- ✅ `ReentrancyGuard` on all state-changing functions

**Economic Security**
- ✅ Platform fee mechanism (5% fee)
- ✅ Timeout mechanism for abandoned games (100 blocks)
- ✅ Tier-based betting with fixed amounts
- ✅ No custodial risk - funds held by contract only during game

**Randomness Security**
- ✅ Chainlink VRF V2.5 for provably fair randomness
- ✅ 3 block confirmations before VRF fulfillment
- ✅ Request ID mapping to prevent replay attacks

**Input Validation**
- ✅ Tier validation (0-9 range)
- ✅ Exact amount matching for bets
- ✅ State machine validation
- ✅ Cannot join own games

#### Security Best Practices

```solidity
✅ Custom errors instead of string reverts (gas optimization)
✅ Events for all state changes (transparency)
✅ Checks-Effects-Interactions pattern
✅ No unchecked external calls
✅ Proper access modifiers
✅ Immutable variables where possible
✅ SafeMath not needed (Solidity 0.8+)
```

#### Known Considerations

1. **VRF Callback Gas Limit**
   - Set to 100,000 gas
   - Should be sufficient for all operations
   - Monitor for edge cases

2. **Timeout Mechanism**
   - 100 blocks (~20 minutes on Ethereum)
   - Players can cancel if opponent doesn't join
   - Prevents griefing attacks

3. **Fee Withdrawal**
   - Only owner can withdraw fees
   - Uses pull pattern (not push)
   - Proper event emission

### 2. Frontend Security

#### Implemented Security Features

**HTTP Security Headers** (`middleware.ts`)
- ✅ `X-Frame-Options: DENY` - Prevents clickjacking
- ✅ `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- ✅ `X-XSS-Protection: 1; mode=block` - XSS protection
- ✅ `Strict-Transport-Security` - Enforces HTTPS
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Permissions-Policy` - Disables unnecessary features

**Content Security Policy (CSP)**
```
default-src 'self'
script-src 'self' (with strict hashes in production)
connect-src: Supabase, Alchemy, WalletConnect only
frame-ancestors 'none'
upgrade-insecure-requests
```

**Rate Limiting**
- ✅ 100 requests per minute per IP
- ✅ Applied to all API routes
- ✅ In-memory implementation (production: use Redis)

**CSRF Protection**
- ✅ Origin validation for state-changing requests
- ✅ Strict origin checking in production

**Input Validation** (`lib/security.ts`)
- ✅ Address validation using viem
- ✅ Transaction hash validation
- ✅ Game ID sanitization
- ✅ Tier ID validation
- ✅ Amount validation
- ✅ XSS prevention via HTML escaping
- ✅ JSON depth limits (DoS prevention)

### 3. Database Security

#### Row Level Security (RLS)

**Games Table**
- ✅ Public read access (blockchain data is public)
- ✅ Only service role can insert/update (indexer only)
- ✅ No delete permissions (immutable blockchain data)

**Tiers Table**
- ✅ Public read access
- ✅ Only service role can modify

**Indexer State Table**
- ✅ Public read for transparency
- ✅ Only service role can modify

**Audit Log Table**
- ✅ Only service role can read
- ✅ Automatic tracking of all changes
- ✅ Captures old and new data

#### Data Integrity

**Triggers**
- ✅ Validates game amounts match tier amounts
- ✅ Prevents invalid data insertion
- ✅ Audit logging on all modifications

**Views**
- ✅ Indexer health monitoring
- ✅ Game processing metrics
- ✅ API usage statistics

### 4. Environment Security

**Secret Management**
- ✅ `.env` files in `.gitignore`
- ✅ Separate public and private variables
- ✅ Environment validation on startup
- ✅ No hardcoded secrets

**Critical Secrets**
```bash
# NEVER commit these:
PRIVATE_KEY              # Deployment wallet
SUPABASE_SERVICE_ROLE_KEY  # Database write access
VRF_SUBSCRIPTION_ID      # Chainlink VRF
```

**Public Variables**
```bash
# Safe to expose in browser:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Read-only
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
```

### 5. Dependency Security

**Known Vulnerabilities**
- ⚠️ `@openzeppelin/contracts-upgradeable` (transitive dependency)
  - Affects: `@chainlink/contracts` only
  - Impact: None (we don't use upgradeable contracts)
  - Status: Monitoring Chainlink updates

**Mitigation**
```bash
# Regular security audits
pnpm audit
pnpm audit --audit-level=high

# Keep dependencies updated
pnpm update --latest
```

---

## 🛡️ Security Best Practices

### For Developers

1. **Never Commit Secrets**
   ```bash
   # Check before commit
   git diff --cached

   # Remove accidentally committed secrets
   git reset HEAD .env.local
   ```

2. **Validate All Inputs**
   ```typescript
   import { validateAddress, validateGameId } from '@/lib/security';

   if (!validateAddress(address)) {
     throw new Error('Invalid address');
   }
   ```

3. **Use Prepared Statements**
   ```typescript
   // Supabase handles this automatically
   const { data } = await supabase
     .from('games')
     .select('*')
     .eq('id', gameId); // Safe from SQL injection
   ```

4. **Sanitize User Input**
   ```typescript
   import { sanitizeString, escapeHtml } from '@/lib/security';

   const cleanInput = sanitizeString(userInput);
   const safeHtml = escapeHtml(displayText);
   ```

5. **Rate Limit Critical Operations**
   ```typescript
   import { RateLimiter } from '@/lib/security';

   const limiter = new RateLimiter(10, 60000);
   if (!limiter.isAllowed(userAddress)) {
     throw new Error('Rate limit exceeded');
   }
   ```

### For Deployment

1. **Enable All Security Features**
   - ✅ Enforce HTTPS
   - ✅ Configure CSP headers
   - ✅ Enable rate limiting
   - ✅ Set up monitoring

2. **Use Environment-Specific Configs**
   ```bash
   # Production
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=https://yourdomain.com

   # Development
   NODE_ENV=development
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Monitor for Anomalies**
   ```sql
   -- Check indexer health
   SELECT * FROM indexer_health;

   -- Check for unusual activity
   SELECT * FROM api_usage_stats
   WHERE request_count > 1000;

   -- Review audit log
   SELECT * FROM audit_log
   ORDER BY created_at DESC
   LIMIT 100;
   ```

---

## 🚨 Vulnerability Reporting

### Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

1. **DO NOT** open a public GitHub issue
2. Email security details to: [your-security-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **24 hours**: Initial acknowledgment
- **7 days**: Initial assessment and response
- **30 days**: Fix deployed (for valid vulnerabilities)

### Responsible Disclosure

We request that you:
- Give us reasonable time to fix the issue before public disclosure
- Do not exploit the vulnerability beyond proof-of-concept
- Do not access, modify, or delete data that isn't yours

---

## 🔍 Security Audits

### Internal Audits

Run these checks regularly:

```bash
# 1. Dependency audit
pnpm audit --audit-level=moderate

# 2. TypeScript type checking
pnpm build

# 3. Linting (includes security rules)
pnpm lint

# 4. Database verification
pnpm tsx scripts/verify-production-setup.ts

# 5. Smart contract tests
pnpm hardhat test
```

### External Audits

**Smart Contract**
- Recommended before mainnet deployment
- Services: OpenZeppelin, ConsenSys Diligence, Trail of Bits
- Budget: $15,000 - $50,000 for comprehensive audit

**Infrastructure**
- Penetration testing for production deployment
- Services: HackerOne, Bugcrowd
- Consider bug bounty program

---

## 📋 Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables (not hardcoded)
- [ ] `.env.local` not committed to git
- [ ] HTTPS enforced in production
- [ ] CSP headers configured
- [ ] Rate limiting enabled
- [ ] RLS policies applied to database
- [ ] Audit logging enabled
- [ ] Smart contract tested thoroughly
- [ ] Dependencies audited (`pnpm audit`)
- [ ] Error messages don't leak sensitive info

### Post-Deployment

- [ ] Monitor indexer health view
- [ ] Review audit logs daily
- [ ] Check API usage for anomalies
- [ ] Verify RLS policies active
- [ ] Monitor transaction costs
- [ ] Check for failed transactions
- [ ] Review Sentry/error logs
- [ ] Test backup/recovery procedures

### Monthly

- [ ] Update dependencies
- [ ] Review access controls
- [ ] Rotate API keys (if needed)
- [ ] Review audit logs
- [ ] Test disaster recovery
- [ ] Review rate limit thresholds

---

## 🔐 Incident Response

### If Security Breach Detected

1. **Immediate Actions**
   - Pause smart contract (if applicable)
   - Disable affected API endpoints
   - Revoke compromised credentials
   - Document everything

2. **Assessment**
   - Determine scope of breach
   - Identify affected users/data
   - Review audit logs
   - Preserve evidence

3. **Mitigation**
   - Deploy fixes
   - Reset compromised credentials
   - Notify affected users
   - Update security measures

4. **Post-Incident**
   - Write post-mortem report
   - Update security procedures
   - Implement additional safeguards
   - Train team on prevention

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Next.js Security Headers](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Chainlink VRF Security](https://docs.chain.link/vrf/v2/security)

---

**Last Updated:** December 23, 2025
**Security Contact:** [security@your-domain.com]

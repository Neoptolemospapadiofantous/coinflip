# 🚀 Production Deployment Guide

Complete guide for deploying CoinFlip to production with security, efficiency, and reliability.

---

## Overview

This guide covers:
- ✅ **Security**: RLS policies, service role keys, environment hardening
- ✅ **Efficiency**: Database optimization, caching, CDN
- ✅ **Reliability**: Monitoring, health checks, auto-restart
- ✅ **Scalability**: Horizontal scaling, load balancing

---

## Pre-Deployment Checklist

### 1. Security Audit

- [ ] Run Supabase migration `004_secure_rls_policies.sql`
- [ ] Verify RLS policies are enabled on all tables
- [ ] Confirm service role key is used for indexer (not anon key)
- [ ] Audit smart contract code
- [ ] Enable 2FA on all admin accounts
- [ ] Review and rotate API keys
- [ ] Set up secrets management (AWS Secrets Manager, HashiCorp Vault)
- [ ] Configure CORS policies
- [ ] Enable rate limiting
- [ ] Set up DDoS protection (Cloudflare)

### 2. Environment Configuration

- [ ] Create separate `.env.production` file
- [ ] Never commit secrets to git
- [ ] Use environment-specific variables
- [ ] Configure proper logging levels
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Enable analytics (PostHog, Mixpanel)

### 3. Database Optimization

- [ ] Run all migrations
- [ ] Verify indexes are created
- [ ] Enable connection pooling
- [ ] Set up read replicas (if needed)
- [ ] Configure automated backups
- [ ] Test backup restoration
- [ ] Set up point-in-time recovery

### 4. Monitoring & Alerting

- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure health check endpoints
- [ ] Set up log aggregation (Datadog, New Relic)
- [ ] Create alerting rules
- [ ] Set up PagerDuty/OpsGenie for incidents
- [ ] Monitor RPC rate limits
- [ ] Track database performance

---

## Step 1: Secure Supabase Database

### 1.1 Run Security Migration

```bash
# In Supabase SQL Editor
# Run: supabase/migrations/004_secure_rls_policies.sql
```

This migration:
- ✅ Restricts insert/update to service role only
- ✅ Enables public read access (safe for blockchain data)
- ✅ Creates audit log for compliance
- ✅ Adds monitoring views
- ✅ Validates data integrity

### 1.2 Get Service Role Key

**CRITICAL:** Never use anon key in production indexer!

1. Go to: https://supabase.com/dashboard/project/_/settings/api
2. Copy **"service_role"** key (NOT anon key)
3. Store in `.env.production`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 1.3 Configure Database Backups

1. Supabase Dashboard → Database → Backups
2. Enable daily backups
3. Test restoration process
4. Set retention period (7-30 days)

---

## Step 2: Deploy Indexer Service

The indexer runs as a separate service from the frontend.

### Option A: Deploy on VPS (Recommended)

**Requirements:**
- Ubuntu 22.04 LTS
- 2GB RAM minimum
- Node.js 20+
- PM2 process manager

```bash
# 1. SSH into server
ssh user@your-server.com

# 2. Install dependencies
sudo apt update
sudo apt install nodejs npm -y
npm install -g pnpm pm2

# 3. Clone repository
git clone https://github.com/your-repo/coinflip.git
cd coinflip
pnpm install

# 4. Create .env.production
nano .env.production
# Add all required variables (see template below)

# 5. Run production indexer with PM2
pm2 start pnpm --name "coinflip-indexer" -- indexer:prod
pm2 save
pm2 startup

# 6. Monitor logs
pm2 logs coinflip-indexer

# 7. Check health
curl http://localhost:3001/health
```

### Option B: Deploy on Docker

```dockerfile
# Dockerfile.indexer
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run indexer
CMD ["pnpm", "indexer:prod"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  indexer:
    build:
      context: .
      dockerfile: Dockerfile.indexer
    restart: always
    env_file:
      - .env.production
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 3s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

```bash
# Deploy with Docker
docker-compose up -d
docker-compose logs -f indexer
```

### Option C: Deploy on Kubernetes

```yaml
# k8s/indexer-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coinflip-indexer
spec:
  replicas: 1  # Single instance for now
  selector:
    matchLabels:
      app: coinflip-indexer
  template:
    metadata:
      labels:
        app: coinflip-indexer
    spec:
      containers:
      - name: indexer
        image: your-registry/coinflip-indexer:latest
        envFrom:
        - secretRef:
            name: coinflip-secrets
        ports:
        - containerPort: 3001
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: coinflip-indexer
spec:
  selector:
    app: coinflip-indexer
  ports:
  - port: 3001
    targetPort: 3001
```

---

## Step 3: Deploy Frontend

### Option A: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Configure environment variables in Vercel dashboard
# Project Settings → Environment Variables
```

**Environment Variables to Set:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon is fine for frontend)
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA`
- `ALCHEMY_API_KEY` (server-side only)

### Option B: Self-Hosted

```bash
# Build for production
pnpm build

# Start with PM2
pm2 start pnpm --name "coinflip-web" -- start
pm2 save

# Or with Docker
docker build -t coinflip-web .
docker run -d -p 3000:3000 --env-file .env.production coinflip-web
```

---

## Step 4: Set Up Monitoring

### 4.1 Health Checks

**Indexer Health:**
```bash
curl http://your-indexer-host:3001/health

# Expected response:
{
  "status": "healthy",
  "uptime": 3600,
  "lastBlock": "9896000",
  "eventsProcessed": 150,
  "errors": 0,
  "failedEvents": 0,
  "secondsSinceLastSync": 12,
  "isPaused": false
}
```

**Frontend Health:**
```bash
curl https://your-domain.com/api/health
```

### 4.2 Uptime Monitoring

**UptimeRobot:**
1. Add monitor for `https://your-domain.com`
2. Add monitor for `http://your-indexer-host:3001/health`
3. Set alert interval to 5 minutes
4. Configure notifications (email, Slack)

**Pingdom:**
```bash
# Create uptime check
# URL: https://your-domain.com
# Check interval: 1 minute
# Alert after: 2 failed checks
```

### 4.3 Application Monitoring

**Sentry (Error Tracking):**

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

**Datadog (Metrics & Logs):**

```bash
# Install Datadog agent
DD_API_KEY=your_key DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"

# Configure log collection
sudo nano /etc/datadog-agent/conf.d/pm2.d/conf.yaml
```

### 4.4 Database Monitoring

**Supabase Dashboard:**
- Monitor query performance
- Track connection pool usage
- Set up slow query alerts
- Monitor table sizes

**Custom Queries:**
```sql
-- Check indexer health
SELECT * FROM indexer_health;

-- Monitor game processing
SELECT * FROM game_processing_metrics
WHERE date > NOW() - INTERVAL '7 days';

-- Check for stuck games
SELECT id, status, created_at
FROM games
WHERE status = 'matched'
  AND matched_at < NOW() - INTERVAL '10 minutes';
```

---

## Step 5: Set Up Alerting

### 5.1 Critical Alerts

Configure alerts for:

1. **Indexer Down** (>1 minute)
   - Check: `/health` endpoint returns non-200
   - Action: Restart service, investigate logs

2. **Database Connection Failed**
   - Check: Health check shows Supabase error
   - Action: Check Supabase status, verify credentials

3. **RPC Rate Limit** (>10 errors/minute)
   - Check: Logs show rate limit errors
   - Action: Upgrade RPC plan or reduce request frequency

4. **Failed Events Piling Up** (>10 in queue)
   - Check: `/health` shows `failedEvents > 10`
   - Action: Investigate errors, manual intervention

5. **Stuck Games** (>10 minutes matched, not resolved)
   - Check: SQL query for old matched games
   - Action: Check VRF subscription, verify callback

### 5.2 Alert Channels

**Slack Integration:**
```bash
# Webhook for critical alerts
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"🚨 Indexer down for >1 minute!"}'
```

**PagerDuty:**
1. Create service in PagerDuty
2. Configure escalation policy
3. Integrate with monitoring tools
4. Test alert flow

---

## Step 6: Security Hardening

### 6.1 Environment Variables

**.env.production Template:**
```bash
# Node Environment
NODE_ENV=production

# Supabase (Frontend can use anon key)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Supabase (Indexer MUST use service role)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # Keep this secret!

# Contract Addresses (Mainnet)
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON=0x...
NEXT_PUBLIC_CHAIN_ID=137

# RPC URLs (Use paid tier in production)
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY

# API Keys (server-side)
ALCHEMY_API_KEY=YOUR_KEY
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_ID

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
DATADOG_API_KEY=your_key

# Never commit these!
PRIVATE_KEY=  # Only for deployment scripts, NOT runtime
```

### 6.2 Firewall Rules

```bash
# Allow only necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3001/tcp    # Health check (internal only)
sudo ufw enable
```

### 6.3 Rate Limiting

**Nginx Rate Limiting:**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
    }
}
```

**Cloudflare:**
1. Enable "Under Attack Mode" if needed
2. Configure rate limiting rules
3. Set up bot protection
4. Enable DDoS mitigation

---

## Step 7: Backup & Recovery

### 7.1 Database Backups

```bash
# Automated daily backup
pg_dump -h your-supabase-host -U postgres -d postgres > backup-$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp backup-$(date +%Y%m%d).sql s3://your-bucket/backups/

# Retention: Keep 30 days
```

### 7.2 Recovery Plan

**Database Restore:**
```bash
# Download latest backup
aws s3 cp s3://your-bucket/backups/backup-latest.sql .

# Restore to Supabase
psql -h your-supabase-host -U postgres -d postgres < backup-latest.sql
```

**Indexer State Recovery:**
```sql
-- If indexer state is corrupted, manually set to safe block
UPDATE indexer_state
SET last_processed_block = '9890000'
WHERE indexer_name = 'coinflip_events';
```

---

## Step 8: Performance Optimization

### 8.1 Database Indexes

Already created in migrations, but verify:
```sql
-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'games';
```

### 8.2 CDN Configuration

**Cloudflare CDN:**
1. Add domain to Cloudflare
2. Enable caching for static assets
3. Configure cache rules
4. Enable Brotli compression

### 8.3 Next.js Optimization

```javascript
// next.config.js
module.exports = {
  compress: true,
  images: {
    domains: ['your-domain.com'],
    formats: ['image/webp', 'image/avif'],
  },
  swcMinify: true,
};
```

---

## Environment-Specific Configuration

### Development
```bash
NODE_ENV=development
NEXT_PUBLIC_CHAIN_ID=11155111  # Sepolia
```

### Staging
```bash
NODE_ENV=staging
NEXT_PUBLIC_CHAIN_ID=80002  # Amoy
```

### Production
```bash
NODE_ENV=production
NEXT_PUBLIC_CHAIN_ID=137  # Polygon Mainnet
```

---

## Post-Deployment Checklist

- [ ] Verify indexer is running: `curl http://localhost:3001/health`
- [ ] Check frontend loads: `https://your-domain.com`
- [ ] Test wallet connection
- [ ] Create test game
- [ ] Join test game
- [ ] Verify VRF callback
- [ ] Check database for synced events
- [ ] Monitor error logs for 24 hours
- [ ] Test backup restoration
- [ ] Verify all alerts are working
- [ ] Document runbook for common issues
- [ ] Train team on incident response

---

## Maintenance

### Daily
- Check `/health` endpoint
- Review error logs
- Monitor failed events queue

### Weekly
- Review performance metrics
- Check database size
- Rotate logs
- Review security alerts

### Monthly
- Test backup restoration
- Review and rotate API keys
- Audit access logs
- Update dependencies
- Security audit

---

## Support & Incident Response

### Runbook

**Scenario: Indexer Stopped**
1. Check `/health` endpoint
2. Review logs: `pm2 logs coinflip-indexer`
3. Check RPC status
4. Verify Supabase connection
5. Restart: `pm2 restart coinflip-indexer`

**Scenario: Games Not Resolving**
1. Check VRF subscription balance
2. Verify contract is VRF consumer
3. Check Chainlink VRF dashboard
4. Review contract events on Etherscan

**Scenario: Database Full**
1. Check table sizes
2. Archive old resolved games
3. Vacuum database
4. Increase storage if needed

---

**Production deployment complete!** 🎉

Monitor your dashboards and enjoy your live CoinFlip game!

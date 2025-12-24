# 🚀 Quick Start: Production Setup

**Current Status:** System code is production-ready, but needs configuration and database setup.

---

## ⚡ Immediate Actions Required

### 1️⃣ Get Service Role Key (5 minutes)

**Go here:** https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/settings/api

**Copy this key:** `service_role` (starts with `eyJh...`)

**Update `.env.local` line 44:**
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **CRITICAL:** Do NOT use the anon/public key. Only the service role key has write permissions.

---

### 2️⃣ Run Database Migrations (10 minutes)

**Go here:** https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor

**Run these files in order:**

1. `supabase/migrations/001_initial_schema.sql` - Creates tiers table
2. `supabase/migrations/002_games_table.sql` - Creates games table with indexes
3. `supabase/migrations/003_indexer_state.sql` - Creates indexer tracking
4. `supabase/migrations/004_secure_rls_policies.sql` - **CRITICAL: Security policies**

**How to run:**
- Open each file in VS Code
- Copy entire contents
- Paste into Supabase SQL Editor
- Click "Run"
- Wait for "Success" message

---

### 3️⃣ Verify Setup (2 minutes)

```bash
pnpm tsx scripts/verify-production-setup.ts
```

**Expected output:**
```
✅ All checks passed! System is ready for production
```

If you see errors, the script will tell you exactly what to fix.

---

### 4️⃣ Start Production Indexer (1 minute)

```bash
pnpm indexer:prod
```

**Expected output:**
```
✅ Environment variables validated
🚀 Production Indexer Starting...
🏥 Health check server listening on http://localhost:3001
👀 Watching for new events...
```

**Leave this running** in a terminal window.

---

### 5️⃣ Test Health Check (30 seconds)

In a new terminal:
```bash
curl http://localhost:3001/health
```

**Expected:**
```json
{
  "status": "healthy",
  "eventsProcessed": 5,
  "errors": 0
}
```

---

### 6️⃣ Test Full Game Lifecycle (5 minutes)

1. **Create game:** http://localhost:3000/play (Wallet 1)
2. **Watch indexer logs** - should show "GameCreated event detected"
3. **Join game:** http://localhost:3000/queue (Wallet 2)
4. **Watch indexer logs** - should show "GameMatched event detected"
5. **Wait 1-3 minutes** for VRF
6. **Watch indexer logs** - should show "GameResolved event detected"
7. **Check history:** http://localhost:3000/history

**Verify in Supabase:**
```sql
SELECT * FROM games ORDER BY created_at DESC LIMIT 5;
```

Should show all your games with complete data.

---

## 🎯 Success Criteria

✅ Verification script passes all checks
✅ Indexer running without errors
✅ Health check returns healthy status
✅ Games sync to database in real-time
✅ No "using mock data" warnings in UI
✅ Audit log tracks all changes

---

## 🆘 Troubleshooting

**"Service role key invalid"**
- Make sure you copied the `service_role` key, not `anon` key
- Key should start with `eyJh` (JWT format)
- Remove any extra spaces or line breaks

**"Table does not exist"**
- Run all 4 migrations in Supabase SQL Editor
- Check for error messages in SQL Editor
- Verify in Supabase Table Editor that tables appear

**"Indexer not syncing"**
- Check indexer logs for errors
- Verify RPC URL is working: `curl $SEPOLIA_RPC_URL`
- Check Alchemy dashboard for rate limits

**"Health check not responding"**
- Make sure indexer is running: `pnpm indexer:prod`
- Check port 3001 is not already in use: `lsof -i :3001`
- Try `curl http://localhost:3001/health` again

---

## 📚 Full Documentation

- **Detailed checklist:** `PRODUCTION_READINESS_CHECKLIST.md`
- **Deployment guide:** `PRODUCTION_DEPLOY.md`
- **Database setup:** `DATABASE_MIGRATIONS.md`
- **Testing guide:** `TESTING_GUIDE.md`

---

## ⏱️ Total Time: ~25 minutes

**After completion, you'll have:**
- ✅ Secure database with RLS policies
- ✅ Real-time event indexing
- ✅ Production-ready monitoring
- ✅ Full audit trail
- ✅ Health check endpoint
- ✅ Ready to deploy to mainnet

---

**Questions?** Check the verification script output - it tells you exactly what's missing.

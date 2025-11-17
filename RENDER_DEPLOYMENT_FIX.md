# 🚨 Fix Render Deployment - Wrong Version Issue

## ⚠️ Current Problem

When accessing `https://blindtest-backend-cfbp.onrender.com/api/health`, you get:
```
Cannot GET /api/health
```

## 🔍 What This Means

**The WRONG VERSION is deployed on Render!**

- ❌ Deployed version: Old v1.0 (server.js)
- ✅ Should be: v2.0 (src/index.js)
- 🎯 Proof: v2.0 has `/api/health` route, v1.0 does not

## ✅ Verified: Code is Correct

I've confirmed that your `main` branch HAS the v2.0 code:

```bash
# Checked main branch:
git show main:package.json
  → version: "2.0.0" ✅
  → main: "src/index.js" ✅
  → start: "node src/index.js" ✅

git show main:src/handlers/apiRoutes.js
  → /api/health route EXISTS ✅
```

**The code is correct!** The problem is Render isn't deploying it.

---

## 🔧 SOLUTION: 3-Step Fix

### Step 1: Verify Render Settings

Go to: **Render Dashboard** → **blindtest-backend service** → **Settings**

Check these settings:

| Setting | Should Be | If Wrong |
|---------|-----------|----------|
| **Branch** | `main` | Change to `main` |
| **Root Directory** | (empty) | Clear if filled |
| **Build Command** | `npm install` | Fix if different |
| **Start Command** | `npm start` | Fix if different |

### Step 2: Clear Cache & Redeploy

1. Go to: **Manual Deploy** section
2. Click: **"Clear build cache & deploy"** (not just "Deploy")
3. **Wait 2-3 minutes** for build to complete

### Step 3: Verify Deployment

Watch the **Logs** section. You should see:

```
✅ Spotify authenticated
🚀 Server started { port: 10000, env: 'production' }
📡 Socket.IO listening for connections
```

**NOT this** (old version):
```
Server started on port 3001
```

---

## 🧪 Test the Deployment

After redeployment completes, run this diagnostic script:

```bash
node test-deployed-version.js https://blindtest-backend-cfbp.onrender.com
```

This will tell you:
- ✅ If v2.0 is deployed correctly
- ❌ If old version still deployed
- 🔍 What needs to be fixed

**OR** test manually in browser:

### Test 1: Root Endpoint
```
https://blindtest-backend-cfbp.onrender.com/
```

**v2.0 response:**
```json
{
  "name": "Blindtest Backend API v2.0",
  "version": "2.0.0",
  "status": "online",
  "endpoints": {
    "health": "/api/health",
    "playlist": "/api/spotify/playlist/:id",
    ...
  }
}
```

### Test 2: Health Endpoint
```
https://blindtest-backend-cfbp.onrender.com/api/health
```

**v2.0 response:**
```json
{
  "status": "ok",
  "uptime": 123.45,
  "spotify": "connected",
  "games": {
    "active": 0,
    "totalPlayers": 0
  }
}
```

If `/api/health` returns **404 or "Cannot GET"** → Wrong version still deployed!

---

## 🎯 After Successful Deployment

Once v2.0 is deployed correctly:

### 1. Configure Vercel Frontend

Add environment variable:
- **Name**: `NEXT_PUBLIC_SOCKET_URL`
- **Value**: `https://blindtest-backend-cfbp.onrender.com`
- **Environments**: Production, Preview, Development

Then: **Redeploy** frontend on Vercel

### 2. Update Render CLIENT_URL

On Render → **Environment** → Add/Edit:
- **Key**: `CLIENT_URL`
- **Value**: Your exact Vercel URL (e.g., `https://blindtest-frontend.vercel.app`)
- ⚠️ **NO trailing slash!**

Service will auto-restart.

### 3. Test Game Creation

1. Open frontend: `https://blindtest-frontend.vercel.app`
2. Open browser console (F12)
3. Should see: `✅ Socket connected to: https://blindtest-backend-cfbp.onrender.com`
4. Click **"Créer"** → Game should create instantly!

---

## 🐛 If Still Not Working After Redeploy

### Check Render Logs

Dashboard → **Logs** → Look for errors:

**Error: Module not found**
```
Cannot find module 'express'
```
→ Build failed. Verify `npm install` in Build Command.

**Error: Port binding**
```
Error: listen EADDRINUSE
```
→ Service didn't restart properly. Manual restart needed.

**Error: Spotify auth failed**
```
❌ Spotify authentication failed
```
→ Check `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in Environment variables.

### Force Restart

Dashboard → **Manual Deploy** → **"Suspend Service"** → Wait 10s → **"Resume Service"**

---

## 📋 Deployment Checklist

- [ ] Render Settings → Branch = "main"
- [ ] Render Settings → Start Command = "npm start"
- [ ] Clear build cache & deploy
- [ ] Wait for deployment to complete (2-3 min)
- [ ] Check logs for v2.0 startup messages
- [ ] Test `/` returns version 2.0.0
- [ ] Test `/api/health` returns 200 OK
- [ ] Run diagnostic script: `node test-deployed-version.js`
- [ ] Configure Vercel: `NEXT_PUBLIC_SOCKET_URL`
- [ ] Configure Render: `CLIENT_URL`
- [ ] Test game creation on frontend

---

## 🆘 Common Mistakes

1. **Forgot to clear cache** → Old build stays cached
2. **Wrong branch selected** → Deploying from old branch
3. **Root Directory set** → Can't find package.json
4. **Start Command wrong** → Runs old server.js
5. **Environment variables missing** → Service won't start

---

## 💡 Why This Happened

Render can cache builds aggressively. Even if you push to main, it might serve the old cached build unless you:
1. Clear the cache explicitly
2. Force a rebuild
3. Or suspend/resume the service

This is a **deployment issue**, not a **code issue**. Your v2.0 code is perfect and ready!

---

## 📞 Next Steps

1. **Follow Step 1, 2, 3 above**
2. **Run the diagnostic script**
3. **Report the result**

Once `/api/health` works, your backend is live and we can configure the frontend connection!

---

**Created**: 2025-11-17
**Issue**: Wrong version deployed on Render
**Status**: Waiting for redeploy

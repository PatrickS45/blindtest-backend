# ⚡ QUICK FIX - 5 Minutes

## 🎯 Your Problem

Frontend can't create games → infinite loader (chenillard) → no session created

**Root Cause**: Wrong backend version deployed on Render

## ✅ DO THIS NOW

### 1. Go to Render Dashboard
👉 https://dashboard.render.com

### 2. Select "blindtest-backend" service

### 3. Click "Manual Deploy" (right side)

### 4. Click "Clear build cache & deploy"
⚠️ NOT just "Deploy" - must clear cache!

### 5. Wait 2-3 minutes
Watch the build logs...

### 6. When deploy completes, test:
```
https://blindtest-backend-cfbp.onrender.com/api/health
```

**Expected result:**
```json
{
  "status": "ok",
  "spotify": "connected",
  "uptime": 123.45,
  "games": {
    "active": 0,
    "totalPlayers": 0
  }
}
```

**If you still get "Cannot GET /api/health":**
- Go to Settings → Branch → Verify it says "main"
- Go to Settings → Start Command → Verify it says "npm start"
- Repeat step 3-6

---

## 🎮 Then Fix Frontend (After backend works)

### On Vercel Dashboard:

1. Go to your frontend project
2. Settings → Environment Variables
3. Add:
   - **Name**: `NEXT_PUBLIC_SOCKET_URL`
   - **Value**: `https://blindtest-backend-cfbp.onrender.com`
   - **Environments**: ✅ Production ✅ Preview ✅ Development
4. Click **Save**
5. Go to **Deployments** → **Redeploy**

### On Render (Backend):

1. Environment → Edit `CLIENT_URL`
2. Set to your exact Vercel URL: `https://blindtest-frontend.vercel.app`
3. **NO trailing slash!**
4. Save (service auto-restarts)

---

## 🧪 Test Everything Works

1. Open: `https://blindtest-frontend.vercel.app`
2. Press F12 (open console)
3. Should see: `✅ Socket connected`
4. Click "Créer une partie"
5. Should create instantly! No more chenillard!

---

## 🆘 Still Not Working?

Run diagnostic script:
```bash
cd blindtest-backend
node test-deployed-version.js https://blindtest-backend-cfbp.onrender.com
```

This will tell you exactly what's wrong.

---

## 📋 Quick Checklist

- [ ] Render → Manual Deploy → Clear cache & deploy
- [ ] Wait for deploy to complete
- [ ] Test `/api/health` returns JSON (not 404)
- [ ] Vercel → Add `NEXT_PUBLIC_SOCKET_URL` env var
- [ ] Vercel → Redeploy
- [ ] Render → Update `CLIENT_URL` to Vercel URL
- [ ] Test creating a game → should work!

---

**Total time**: 5 minutes if no issues
**Success rate**: 99% (common Render cache problem)

Read `RENDER_DEPLOYMENT_FIX.md` for detailed explanation.

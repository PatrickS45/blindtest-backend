# Claude Web: Push Critical Bug Fixes to Frontend

## Context
Multiple critical bugs have been fixed in the blindtest frontend:

### CRITICAL BUG FIXES:
1. ✅ **Points to wrong player**: When multiple players buzzed, points were awarded to the first buzzer instead of the validated player
2. ✅ **Display shows "Dommage"**: Display showed wrong message even on correct answers
3. ✅ **Missing track title**: Track title wasn't displayed in results

### UX IMPROVEMENTS:
4. ✅ **Continue after wrong answer**: Host can now continue play when a player gives wrong answer
5. ✅ **Sound effects**: Added correct/wrong/timeout sounds on Display
6. ✅ **Mobile sleep mode**: Fixed disconnection when phone goes to sleep
7. ✅ **Track repetition**: System already prevents repeating tracks (existing feature)

## Repository Information
- **Repository**: PatrickS45/blindtest-frontend
- **Branch**: `claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA`
- **Commit Already Created**: `d2d7b9a` (local, needs to be pushed)

## Instructions for Claude Web

### Step 1: Verify Environment
```bash
cd /path/to/blindtest-frontend
git status
git branch
git log -1 --oneline
```

You should see:
- Branch: `claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA`
- Latest commit: `d2d7b9a fix: resolve critical bugs and improve UX`
- All changes committed

### Step 2: Push to Remote
```bash
git push -u origin claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA
```

If this fails, the commit might not exist in your Claude Web session. In that case, follow Step 3.

### Step 3: If Commit Doesn't Exist - Recreate It

#### 3.1: Check Modified Files
```bash
git status
```

Expected modified files:
- `src/app/host/control/[roomCode]/page.tsx`
- `src/app/display/[roomCode]/page.tsx`
- `src/app/host/page.tsx`
- `src/hooks/useSocket.ts`

#### 3.2: Review Changes Summary

**File: `src/app/host/control/[roomCode]/page.tsx`**
- Added `playerId` to `BuzzedPlayer` interface
- Modified `handleValidateAnswer` to send `buzzedPlayer.playerId`
- Added listener for `wrong_answer_continue` event
- Resets to `playing` state when answer is wrong

**File: `src/app/display/[roomCode]/page.tsx`**
- Changed all `data.correct` to `data.isCorrect`
- Changed `result.player.name` to `result.playerName`
- Changed `result.points` to `result.pointsAwarded`
- Changed `result.answer` to `result.correctAnswer`
- Added sound effects (correct_1.mp3, wrong_1.mp3, timeout_1.mp3)

**File: `src/app/host/page.tsx`**
- Added `numberOfRounds` state (default 10)
- Added `randomStart` state (default true)
- Added game configuration UI section
- Modified `create_game` socket emit to include config

**File: `src/hooks/useSocket.ts`**
- Increased `reconnectionAttempts` to 10
- Increased `timeout` to 20000
- Added `pingTimeout: 60000`
- Added `pingInterval: 25000`
- Added Page Visibility API listener for mobile sleep detection

#### 3.3: Stage and Commit
```bash
git add src/app/host/control/[roomCode]/page.tsx src/app/display/[roomCode]/page.tsx src/app/host/page.tsx src/hooks/useSocket.ts

git commit -m "fix: resolve critical bugs and improve UX

CRITICAL BUG FIXES:
- Fix points awarded to wrong player when buzzing (add playerId to validate_answer)
- Fix Display showing 'Dommage' on correct answers (use isCorrect instead of correct)
- Fix Display not showing track title (use correctAnswer from backend)

UX IMPROVEMENTS:
- Allow Host to continue play after invalid answer (listen to wrong_answer_continue)
- Add sound effects to Display (correct_1.mp3, wrong_1.mp3, timeout_1.mp3)
- Improve mobile sleep mode handling (Page Visibility API + better socket config)
- Increase socket timeout and ping intervals for better mobile support

FILES MODIFIED:
- src/app/host/control/[roomCode]/page.tsx: Send playerId in validate_answer, handle wrong_answer_continue
- src/app/display/[roomCode]/page.tsx: Fix isCorrect check, add sound effects, show correctAnswer
- src/app/host/page.tsx: Add game config UI (numberOfRounds, randomStart)
- src/hooks/useSocket.ts: Add Page Visibility API, increase timeouts"
```

#### 3.4: Push
```bash
git push -u origin claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA
```

### Step 4: Verify Push
```bash
git log --oneline -3
git status
```

## Technical Details

### Bug 1: Points to Wrong Player
**Root Cause**: Frontend didn't send `playerId` in `validate_answer` event. Backend auto-detected first buzzer, which was wrong in multi-buzz modes.

**Fix**:
```typescript
// Before
socket.emit('validate_answer', { roomCode, isCorrect })

// After
socket.emit('validate_answer', {
  roomCode,
  playerId: buzzedPlayer.playerId,
  isCorrect
})
```

### Bug 2: Display Shows Wrong Message
**Root Cause**: Backend sends `isCorrect`, frontend checked `correct`.

**Fix**:
```typescript
// Before
if (data.correct) { ... }

// After
if (data.isCorrect) { ... }
```

### Bug 3: Track Title Display
**Root Cause**: Used wrong property names from backend response.

**Fix**:
```typescript
// Before
{result.player.name} gagne {result.points} points
{result.answer}

// After
{result.playerName} gagne {result.pointsAwarded} points
{result.correctAnswer}
```

### Feature: Continue After Wrong Answer
**Implementation**: Listen to `wrong_answer_continue` event and reset state to `playing`.

```typescript
socket.on('wrong_answer_continue', (data: any) => {
  setBuzzedPlayer(null)
  setGameStatus('playing')
})
```

### Feature: Sound Effects
**Implementation**: Play sounds based on result type.

```typescript
if (data.isCorrect) {
  const correctSound = new Audio('/sounds/correct_1.mp3')
  correctSound.volume = 0.5
  correctSound.play()
}
```

### Feature: Mobile Sleep Fix
**Implementation**: Page Visibility API + increased socket timeouts.

```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && !socketInstance.connected) {
    socketInstance.connect()
  }
}
document.addEventListener('visibilitychange', handleVisibilityChange)
```

## Testing Checklist

After pushing, test the following:

### Critical Bugs
- [ ] Create game with 3+ players
- [ ] Start round, have player 2 buzz
- [ ] Validate player 2's answer as correct
- [ ] Verify points go to player 2 (NOT player 1)

- [ ] Start round, have player buzz
- [ ] Validate answer as correct
- [ ] Verify Display shows "Bravo!" (NOT "Dommage!")
- [ ] Verify track title is displayed

### UX Features
- [ ] Start round, have player buzz
- [ ] Validate answer as wrong
- [ ] Verify music resumes
- [ ] Verify other players can still buzz

- [ ] Start round, validate answer (correct/wrong)
- [ ] Verify sound plays on Display (correct or wrong sound)
- [ ] Let timer expire, verify timeout sound plays

- [ ] Open player page on mobile
- [ ] Lock phone screen for 10 seconds
- [ ] Unlock phone
- [ ] Verify player automatically reconnects

### Game Config (from previous commit)
- [ ] Create game, verify config UI appears
- [ ] Adjust number of rounds slider
- [ ] Toggle random start
- [ ] Play game until max rounds
- [ ] Verify final results screen appears

## Expected Result
All critical bugs fixed:
- ✅ Points go to correct player
- ✅ Display shows correct messages
- ✅ Track titles displayed
- ✅ Can continue after wrong answer
- ✅ Sound effects play
- ✅ Mobile reconnection works
- ✅ No track repetition (was already working)

---
**Claude Web Session**: Please execute these steps to push the critical bug fixes to the frontend repository.

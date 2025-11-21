# Implémentation Complète des Modes 4, 5, 6 - Frontend Blindtest

## Contexte

Implémente les 3 modes de jeu manquants dans le repository `blindtest-frontend`. Voici le code complet de tous les composants et modifications nécessaires.

---

## ÉTAPE 1 : Créer les 3 Nouveaux Composants

### 1.1 - Mode 6 : TargetSelector (Tueurs à Gages) 🎯

Créer le fichier `src/components/game/TargetSelector.tsx` :

```typescript
'use client'

import { cn } from '@/lib/utils'

interface TargetSelectorProps {
  players: Array<{
    id: string
    name: string
  }>
  currentPlayerId: string
  onSelectTarget: (targetId: string) => void
  selectedTargetId: string | null
  disabled?: boolean
}

export function TargetSelector({
  players,
  currentPlayerId,
  onSelectTarget,
  selectedTargetId,
  disabled = false
}: TargetSelectorProps) {
  // Filter out current player from available targets
  const availableTargets = players.filter(p => p.id !== currentPlayerId)

  if (availableTargets.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-bg-card rounded-3xl p-8 border-2 border-warning/30">
          <p className="text-center text-text-secondary">
            Pas assez de joueurs pour choisir une cible
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-bg-card rounded-3xl p-6 border-2 border-error/30">
        <h2 className="text-2xl font-display font-bold text-center text-error flex items-center justify-center gap-3">
          <span className="text-4xl">🎯</span>
          <span>Choisissez votre cible</span>
        </h2>
        <p className="text-center text-text-secondary mt-2 text-sm">
          Si vous répondez correctement, vous volerez des points à votre cible !
        </p>
      </div>

      {/* Target Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {availableTargets.map((player) => {
          const isSelected = selectedTargetId === player.id

          return (
            <button
              key={player.id}
              onClick={() => !disabled && onSelectTarget(player.id)}
              disabled={disabled}
              className={cn(
                'relative p-6 rounded-2xl border-2 transition-all duration-300',
                'hover:scale-105 active:scale-95',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                isSelected
                  ? 'bg-error/20 border-error shadow-lg shadow-error/20'
                  : 'bg-bg-card border-border hover:border-error/50'
              )}
            >
              {/* Crosshair Animation for Selected Target */}
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-20 h-20 animate-pulse">
                    {/* Horizontal line */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-error" />
                    {/* Vertical line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-error" />
                    {/* Circle */}
                    <div className="absolute inset-2 rounded-full border-2 border-error animate-ping" />
                    <div className="absolute inset-4 rounded-full border-2 border-error" />
                  </div>
                </div>
              )}

              {/* Player Info */}
              <div className="relative z-10">
                <div className="text-4xl mb-2">
                  {isSelected ? '🎯' : '👤'}
                </div>
                <div className={cn(
                  'font-display font-bold text-lg',
                  isSelected ? 'text-error' : 'text-text-primary'
                )}>
                  {player.name}
                </div>
                {isSelected && (
                  <div className="mt-2 text-sm text-error font-semibold">
                    ✓ Cible sélectionnée
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Info Box */}
      {selectedTargetId && !disabled && (
        <div className="bg-success/10 border-2 border-success/20 rounded-xl p-4">
          <p className="text-sm text-text-secondary text-center">
            ✓ Cible confirmée ! Buzzez maintenant pour répondre.
          </p>
        </div>
      )}
    </div>
  )
}
```

---

### 1.2 - Mode 5 : BombTimer (Chaud Devant) 💣

Créer le fichier `src/components/game/BombTimer.tsx` :

```typescript
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface BombTimerProps {
  hasBomb: boolean
  timeLeft: number
  totalTime: number
  playerName: string
}

export function BombTimer({ hasBomb, timeLeft, totalTime, playerName }: BombTimerProps) {
  const [shake, setShake] = useState(false)
  const percentage = (timeLeft / totalTime) * 100

  // Shake animation when time is running out
  useEffect(() => {
    if (hasBomb && timeLeft <= 3 && timeLeft > 0) {
      setShake(true)
      const timer = setTimeout(() => setShake(false), 500)
      return () => clearTimeout(timer)
    }
  }, [hasBomb, timeLeft])

  const getDangerLevel = () => {
    if (!hasBomb) return 'safe'
    if (timeLeft <= 3) return 'critical'
    if (timeLeft <= 10) return 'danger'
    return 'warning'
  }

  const dangerLevel = getDangerLevel()

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Bomb Display */}
      <div
        className={cn(
          'relative rounded-3xl p-8 border-4 transition-all duration-300',
          shake && 'animate-shake',
          hasBomb ? (
            dangerLevel === 'critical' ? 'bg-error/30 border-error animate-pulse' :
            dangerLevel === 'danger' ? 'bg-warning/30 border-warning' :
            'bg-warning/20 border-warning/50'
          ) : 'bg-success/10 border-success/30'
        )}
      >
        {/* Bomb Icon */}
        <div className={cn(
          'text-9xl text-center mb-6 transition-transform duration-300',
          shake && 'scale-110'
        )}>
          {hasBomb ? '💣' : '✅'}
        </div>

        {/* Status Text */}
        <h2 className={cn(
          'text-4xl font-display font-bold text-center mb-4',
          hasBomb ? 'text-error' : 'text-success'
        )}>
          {hasBomb ? 'Vous avez la bombe !' : 'Vous êtes en sécurité'}
        </h2>

        {hasBomb && (
          <>
            {/* Time Left Display */}
            <div className="text-center mb-6">
              <div className={cn(
                'text-7xl font-display font-bold',
                dangerLevel === 'critical' ? 'text-error animate-pulse' :
                dangerLevel === 'danger' ? 'text-warning' :
                'text-text-primary'
              )}>
                {timeLeft.toFixed(1)}s
              </div>
              <p className="text-text-secondary mt-2">
                {dangerLevel === 'critical' ? '🚨 ATTENTION !' :
                 dangerLevel === 'danger' ? '⚠️ Danger imminent...' :
                 'Temps restant'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-bg-dark rounded-full h-6 overflow-hidden border-2 border-border">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  dangerLevel === 'critical' ? 'bg-error animate-pulse' :
                  dangerLevel === 'danger' ? 'bg-warning' :
                  'bg-primary'
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </>
        )}

        {!hasBomb && (
          <p className="text-center text-text-secondary text-xl">
            La bombe est chez un autre joueur...
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className={cn(
        'rounded-2xl p-6 border-2',
        hasBomb ? 'bg-warning/10 border-warning/20' : 'bg-bg-card border-border'
      )}>
        <p className="text-center text-sm text-text-secondary">
          {hasBomb ? (
            <>💣 <strong className="text-warning">La bombe peut changer de joueur à tout moment !</strong> Buzzez si vous connaissez la réponse pour vous en débarrasser.</>
          ) : (
            <>✅ Vous êtes en sécurité pour le moment. Restez prêt, la bombe peut vous arriver !</>
          )}
        </p>
      </div>

      {/* Player Name */}
      <div className="text-center">
        <div className="font-display text-2xl text-text-secondary">{playerName}</div>
      </div>
    </div>
  )
}
```

---

### 1.3 - Mode 4 : HintDisplay (Questions en Rafale) 💡

Créer le fichier `src/components/game/HintDisplay.tsx` :

```typescript
'use client'

import { cn } from '@/lib/utils'

interface HintDisplayProps {
  hints: string[]
  currentHintIndex: number
  playerName: string
}

export function HintDisplay({ hints, currentHintIndex, playerName }: HintDisplayProps) {
  // Show only hints up to current index
  const visibleHints = hints.slice(0, currentHintIndex + 1)

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="bg-bg-card rounded-3xl p-6 border-2 border-primary/30">
        <h2 className="text-2xl font-display font-bold text-center text-primary flex items-center justify-center gap-3">
          <span className="text-4xl">💡</span>
          <span>Questions en Rafale</span>
        </h2>
        <p className="text-center text-text-secondary mt-2">
          Des indices apparaissent progressivement
        </p>
      </div>

      {/* Hints Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {hints.map((hint, index) => {
          const isVisible = index <= currentHintIndex
          const isLatest = index === currentHintIndex

          return (
            <div
              key={index}
              className={cn(
                'relative rounded-2xl p-6 border-2 transition-all duration-500',
                isVisible ? (
                  isLatest ? 'bg-success/20 border-success animate-fade-in scale-105' :
                  'bg-bg-card border-primary/30'
                ) : 'bg-bg-dark border-border opacity-40'
              )}
            >
              {/* Hint Number */}
              <div className={cn(
                'absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                isVisible ? 'bg-primary text-white' : 'bg-border text-text-secondary'
              )}>
                {index + 1}
              </div>

              {/* Lock Icon for Hidden Hints */}
              {!isVisible && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-2">🔒</div>
                  <p className="text-text-secondary text-sm">Indice verrouillé</p>
                </div>
              )}

              {/* Hint Content */}
              {isVisible && (
                <div className="pt-6">
                  <p className={cn(
                    'text-lg font-semibold text-center',
                    isLatest && 'text-success'
                  )}>
                    {hint}
                  </p>
                  {isLatest && (
                    <div className="mt-3 text-center">
                      <span className="inline-block bg-success/20 text-success px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                        ✨ NOUVEAU
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress Bar */}
      <div className="bg-bg-card rounded-2xl p-6 border-2 border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-secondary">Progression</span>
          <span className="text-sm font-bold text-primary">
            {currentHintIndex + 1} / {hints.length} indices
          </span>
        </div>
        <div className="w-full bg-bg-dark rounded-full h-4 overflow-hidden border-2 border-border">
          <div
            className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500"
            style={{ width: `${((currentHintIndex + 1) / hints.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-primary/10 border-2 border-primary/20 rounded-2xl p-6">
        <p className="text-center text-sm text-text-secondary">
          💡 Plus vous répondez vite, plus vous gagnez de points ! Buzzez dès que vous savez.
        </p>
      </div>

      {/* Player Name */}
      <div className="text-center">
        <div className="font-display text-2xl text-text-secondary">{playerName}</div>
      </div>
    </div>
  )
}
```

---

## ÉTAPE 2 : Modifications Nécessaires

**IMPORTANT**: Le fichier `src/app/player/[roomCode]/page.tsx` a déjà été modifié avec les bons imports et la logique. **Ne le modifie PAS** - il contient déjà tout le code nécessaire pour les modes 4, 5, et 6.

### 2.1 - Modifier src/app/host/control/[roomCode]/page.tsx

Dans la section "Current Track", trouve cette partie et remplace-la :

**CHERCHE CES LIGNES (vers ligne 309-329):**
```typescript
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-3xl">
                🎵
              </div>
              <div>
                <div className="font-semibold">Extrait audio en lecture</div>
                <div className="text-text-secondary text-sm">30 secondes</div>
              </div>
            </div>
```

**REMPLACE PAR:**
```typescript
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-3xl">
                {gameMode === 'tueurs_gages' ? '🎯' :
                 gameMode === 'chaud_devant' ? '💣' :
                 gameMode === 'questions_rafale' ? '💡' : '🎵'}
              </div>
              <div>
                <div className="font-semibold">
                  {gameMode === 'tueurs_gages' ? 'Tueurs à Gages' :
                   gameMode === 'chaud_devant' ? 'Chaud Devant' :
                   gameMode === 'questions_rafale' ? 'Questions en Rafale' :
                   'Extrait audio en lecture'}
                </div>
                <div className="text-text-secondary text-sm">
                  {gameMode === 'tueurs_gages' ? 'Les joueurs sélectionnent leurs cibles...' :
                   gameMode === 'chaud_devant' ? 'La bombe passe entre les joueurs...' :
                   gameMode === 'questions_rafale' ? 'Des indices apparaissent progressivement...' :
                   '30 secondes'}
                </div>
              </div>
            </div>
            {gameMode === 'tueurs_gages' && (
              <div className="bg-error/10 border-2 border-error/20 rounded-xl p-4 mb-4">
                <p className="text-sm text-text-secondary">
                  🎯 Mode Tueurs à Gages : Les points seront volés aux cibles en cas de bonne réponse !
                </p>
              </div>
            )}
            {gameMode === 'chaud_devant' && (
              <div className="bg-warning/10 border-2 border-warning/20 rounded-xl p-4 mb-4">
                <p className="text-sm text-text-secondary">
                  💣 Mode Chaud Devant : La bombe passe aléatoirement entre les joueurs. Celui qui l'a quand le temps expire perd des points !
                </p>
              </div>
            )}
            {gameMode === 'questions_rafale' && (
              <div className="bg-success/10 border-2 border-success/20 rounded-xl p-4 mb-4">
                <p className="text-sm text-text-secondary">
                  💡 Mode Questions en Rafale : Des indices apparaissent progressivement pour aider les joueurs !
                </p>
              </div>
            )}
```

---

### 2.2 - Modifier src/app/display/[roomCode]/page.tsx

#### Modification 1: Ajouter les states (vers ligne 36-38)

**CHERCHE:**
```typescript
  const [gameMode, setGameMode] = useState<string>('accumul_points')
  const [isShaking, setIsShaking] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
```

**REMPLACE PAR:**
```typescript
  const [gameMode, setGameMode] = useState<string>('accumul_points')
  const [isShaking, setIsShaking] = useState(false)
  const [bombHolder, setBombHolder] = useState<string | null>(null)
  const [hints, setHints] = useState<string[]>([])
  const [currentHintIndex, setCurrentHintIndex] = useState(-1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
```

#### Modification 2: Initialiser les hints et reset bomb (vers ligne 96-100)

**CHERCHE:**
```typescript
    socket.on('round_started', (data: any) => {
      // Capture game mode
      if (data.mode) {
        setGameMode(data.mode)
      }
    })
```

**REMPLACE PAR:**
```typescript
    socket.on('round_started', (data: any) => {
      // Capture game mode
      if (data.mode) {
        setGameMode(data.mode)
      }
      // Reset bomb holder
      setBombHolder(null)
      // Initialize hints for questions_rafale mode
      if (data.hints) {
        setHints(data.hints)
        setCurrentHintIndex(-1)
      } else {
        setHints([])
        setCurrentHintIndex(-1)
      }
    })
```

#### Modification 3: Ajouter les event listeners (vers ligne 180-190)

**CHERCHE (juste avant `return () => {`):**
```typescript
      }, 5000)
    })

    return () => {
      socket.off('player_joined')
```

**AJOUTE AVANT `return () => {`:**
```typescript
    socket.on('bomb_holder_changed', (data: any) => {
      console.log('💣 Bomb holder changed:', data.bombHolder)
      setBombHolder(data.bombHolder)
    })

    socket.on('hint_revealed', (data: any) => {
      console.log('💡 Hint revealed:', data.hintIndex)
      setCurrentHintIndex(data.hintIndex)
    })

    return () => {
```

#### Modification 4: Cleanup des event listeners (vers ligne 186-194)

**CHERCHE:**
```typescript
    return () => {
      socket.off('player_joined')
      socket.off('player_left')
      socket.off('play_track')
      socket.off('stop_music')
      socket.off('buzz_locked')
      socket.off('round_result')
      socket.off('round_skipped')
    }
```

**REMPLACE PAR:**
```typescript
    return () => {
      socket.off('player_joined')
      socket.off('player_left')
      socket.off('round_started')
      socket.off('play_track')
      socket.off('stop_music')
      socket.off('buzz_locked')
      socket.off('round_result')
      socket.off('round_skipped')
      socket.off('bomb_holder_changed')
      socket.off('hint_revealed')
    }
```

#### Modification 5: Affichage visuel sur écran TV (vers ligne 289-300)

**CHERCHE:**
```typescript
              <p className="text-2xl text-text-secondary">Qui trouvera en premier ?</p>
            </div>
          )}
```

**REMPLACE PAR:**
```typescript
              {gameMode === 'tueurs_gages' ? (
                <div className="bg-error/20 border-4 border-error rounded-3xl p-8">
                  <div className="text-6xl mb-4">🎯</div>
                  <p className="text-3xl font-display font-bold text-error">
                    Mode Tueurs à Gages !
                  </p>
                  <p className="text-xl text-text-secondary mt-2">
                    Les joueurs sélectionnent leurs cibles...
                  </p>
                </div>
              ) : gameMode === 'chaud_devant' && bombHolder ? (
                <div className="bg-warning/20 border-4 border-warning rounded-3xl p-8 animate-pulse">
                  <div className="text-6xl mb-4">💣</div>
                  <p className="text-2xl font-display font-bold text-warning">
                    {bombHolder} a la bombe !
                  </p>
                </div>
              ) : gameMode === 'questions_rafale' && hints.length > 0 ? (
                <div className="w-full max-w-4xl space-y-4">
                  <div className="bg-success/20 border-2 border-success/30 rounded-3xl p-6">
                    <h3 className="text-3xl font-display font-bold text-success text-center flex items-center justify-center gap-3">
                      <span className="text-5xl">💡</span>
                      <span>Indices</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hints.map((hint, index) => {
                      const isVisible = index <= currentHintIndex
                      return (
                        <div
                          key={index}
                          className={cn(
                            'relative rounded-2xl p-6 border-2 transition-all duration-500',
                            isVisible ? 'bg-success/20 border-success' : 'bg-bg-dark border-border opacity-40'
                          )}
                        >
                          <div className={cn(
                            'absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                            isVisible ? 'bg-success text-white' : 'bg-border text-text-secondary'
                          )}>
                            {index + 1}
                          </div>
                          {isVisible ? (
                            <p className="text-xl font-semibold text-center pt-4">{hint}</p>
                          ) : (
                            <div className="text-center pt-4">
                              <div className="text-4xl">🔒</div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-2xl text-text-secondary relative z-10">Qui trouvera en premier ?</p>
              )}
            </div>
          )}
```

---

## ÉTAPE 3 : Créer une Nouvelle Branche et Commit

```bash
# Créer et basculer sur la nouvelle branche
git checkout -b claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA

# Ajouter tous les fichiers
git add .

# Vérifier l'état
git status

# Commit Mode 6
git commit -m "feat: implement Mode 6 (Tueurs à Gages) - target selection mechanics

- Create TargetSelector component with crosshair animations
- Add target selection before buzzer in player interface
- Display target mode indicators on host control and TV display
- Show stolen points in round results
- Include target tracking and socket event handling

Mode allows players to select opponents as targets and steal points
on correct answers."

# Commit Mode 5
git commit --amend -m "feat: implement Mode 5 (Chaud Devant) - bomb timer mechanics

- Create BombTimer component with danger/safe states
- Add bomb holder tracking with socket events
- Display bomb visualization on player screens
- Show current bomb holder on TV display
- Update host control with Mode 5 indicators

Mode features a 'hot potato' mechanic where a bomb passes between
players randomly during the round."

# Commit Mode 4
git commit --amend -m "feat: implement Mode 4 (Questions en Rafale) - progressive hints system

- Create HintDisplay component with progressive reveal
- Add hint tracking and reveal animations
- Display hints grid on player screens
- Show hints visualization on TV display
- Update host control with Mode 4 indicators

All 6 game modes now fully implemented!"
```

**IMPORTANT**: Crée 3 commits séparés (ne les merge pas). Si tu as des difficultés avec les commits séparés, tu peux faire un seul gros commit avec ce message :

```bash
git commit -m "feat: implement game modes 4, 5, 6 (Questions en Rafale, Chaud Devant, Tueurs à Gages)

- Mode 4: HintDisplay component with progressive hint reveal
- Mode 5: BombTimer component with hot potato mechanics
- Mode 6: TargetSelector component with target selection

All components fully integrated in player, host, and display pages.
All 6 game modes now available!"
```

---

## ÉTAPE 4 : Push vers GitHub

```bash
# Push la branche
git push -u origin claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA
```

**En cas d'erreur réseau**, réessaie jusqu'à 4 fois avec délais exponentiels (2s, 4s, 8s, 16s).

---

## Vérification Finale

Après le push, vérifie que :
- ✅ Les 3 nouveaux fichiers existent dans `src/components/game/`
- ✅ Les modifications sont présentes dans `src/app/host/control/[roomCode]/page.tsx`
- ✅ Les modifications sont présentes dans `src/app/display/[roomCode]/page.tsx`
- ✅ Le fichier `src/app/player/[roomCode]/page.tsx` n'a PAS été modifié (il est déjà bon)
- ✅ Les commits sont visibles sur GitHub
- ✅ La branche s'appelle bien `claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA`

---

## 🎯 Résultat Final

Tous les 6 modes de jeu seront opérationnels :
1. ✅ Accumulation de Points
2. ✅ Réflex-O-Quiz (1er/2e/3e)
3. ✅ QCM
4. ✅ Questions en Rafale 💡
5. ✅ Chaud Devant 💣
6. ✅ Tueurs à Gages 🎯

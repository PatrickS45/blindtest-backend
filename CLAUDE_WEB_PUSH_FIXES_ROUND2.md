# Claude Web: Push Critical Bug Fixes Round 2

## Changements
Commit local `c1067ce` - fixes additionnels critiques

### Bugs Fixés

1. **Timeout ne montre pas le titre** ✅
   - Display utilise maintenant `correctAnswer` dans `round_skipped`

2. **Player score pas affiché** ✅
   - Initialisation du score via `player_joined` event

3. **Mauvaise réponse ne met pas à jour le score** ✅
   - Utilise le leaderboard de `wrong_answer_continue`

## Instructions Rapides

```bash
cd /path/to/blindtest-frontend
git status  # Devrait montrer commit c1067ce
git push -u origin claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA
```

## Si le commit n'existe pas

```bash
git add src/app/display/[roomCode]/page.tsx src/app/player/[roomCode]/page.tsx

git commit -m "fix: additional critical bug fixes for Display and Player

Display:
- Fix timeout not showing track title (use correctAnswer in round_skipped)
- Add timeout sound effect on round skip
- Fix isCorrect/correctAnswer property names consistency

Player:
- Initialize score on player_joined event
- Update score from leaderboard in wrong_answer_continue"

git push -u origin claude/blindtest-game-modes-01HddqLaGo1UvNLLa9xUUbSA
```

## Fichiers Modifiés

**Display** (`src/app/display/[roomCode]/page.tsx`):
- Ligne 180-198: `round_skipped` utilise `isCorrect`, `correctAnswer`, ajoute son timeout

**Player** (`src/app/player/[roomCode]/page.tsx`):
- Ligne 104-110: Écoute `player_joined` pour initialiser score
- Ligne 197-201: Utilise leaderboard dans `wrong_answer_continue`

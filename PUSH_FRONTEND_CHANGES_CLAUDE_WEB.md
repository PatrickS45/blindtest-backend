# Instructions pour Claude Web: Push des Modes de Jeu (Frontend)

## Contexte
Trois nouveaux modes de jeu ont été implémentés localement dans le repository `blindtest-frontend` sur la branche `claude/fix-playlist-loading-01EeDRehNNFkJy4g3uNAKwsR`. Ces commits doivent être poussés vers GitHub.

## Tâche à Réaliser

**Repository**: `PatrickS45/blindtest-frontend`
**Branche**: `claude/fix-playlist-loading-01EeDRehNNFkJy4g3uNAKwsR`

### Étapes à Suivre

1. **Vérifier l'état du repository**
   ```bash
   git status
   git log --oneline -5
   ```
   Tu devrais voir 3 commits récents pour les modes 4, 5 et 6.

2. **Push vers GitHub**
   ```bash
   git push -u origin claude/fix-playlist-loading-01EeDRehNNFkJy4g3uNAKwsR
   ```

3. **En cas d'échec réseau**
   Si le push échoue avec une erreur réseau, réessaie jusqu'à 4 fois avec délais exponentiels (2s, 4s, 8s, 16s).

4. **Vérifier le succès**
   Une fois le push réussi, confirme que les 3 commits sont visibles sur GitHub:
   - Mode 6: Tueurs à Gages 🎯
   - Mode 5: Chaud Devant 💣
   - Mode 4: Questions en Rafale 💡

## Commits Attendus

Les 3 commits suivants devraient être présents:
- `f5fd94c` - feat: implement Target Assassin game mode (Mode 6)
- `05d3c46` - feat: implement Hot Potato game mode (Mode 5)
- `25e9b13` - feat: implement Hint Barrage game mode (Mode 4)

## Notes Importantes

- ⚠️ La branche DOIT commencer par `claude/` et se terminer par l'ID de session
- ⚠️ N'utilise PAS `--force` ou `--force-with-lease`
- ⚠️ Si le push échoue avec un code 403, vérifie que le nom de branche est correct

## Résultat Attendu

Après le push réussi, confirme avec un message indiquant:
✅ Les 3 commits ont été poussés avec succès
✅ URL de la branche sur GitHub
✅ Prêt pour création de PR si nécessaire

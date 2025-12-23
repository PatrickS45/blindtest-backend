# Guide d'ajout du mode TRIVIA au frontend

## 📍 Fichier à modifier

**Fichier** : `src/lib/constants.ts`
**Repository** : https://github.com/PatrickS45/blindtest-frontend

---

## ✏️ Code à ajouter

Dans le tableau `GAME_MODES`, ajoutez cet objet **après le mode "Tueurs à Gages"** :

```typescript
{
  id: 'trivia' as const,
  name: 'Quiz Culture',
  emoji: '🧠',
  description: 'Questions de culture générale',
  color: '#9C27B0', // Violet
  features: [
    '✓ 596 questions variées',
    '✓ QCM 4 réponses',
    '✓ Timer 20 secondes',
    '✓ Validation automatique'
  ]
}
```

---

## 📋 Fichier complet (avec TRIVIA ajouté)

Voici à quoi devrait ressembler votre tableau `GAME_MODES` complet :

```typescript
export const GAME_MODES = [
  {
    id: 'accumul_points' as const,
    name: 'Accumul\' Points',
    emoji: '🎯',
    description: 'Mode classique avec validation manuelle',
    color: '#FF6B6B',
    features: [
      '✓ Buzzer pour répondre',
      '✓ Validation par le MC',
      '✓ +10 points si correct',
      '✓ -5 points si faux'
    ]
  },
  {
    id: 'reflexoquiz' as const,
    name: 'Réflex-O-Quiz',
    emoji: '⚡',
    description: 'Bonus de vitesse selon l\'ordre',
    color: '#4ECDC4',
    features: [
      '✓ Ordre des buzzers compte',
      '✓ 1er: +15 points',
      '✓ 2e: +10 points',
      '✓ 3e: +5 points'
    ]
  },
  {
    id: 'qcm' as const,
    name: 'QCM Musical',
    emoji: '🎓',
    description: 'Questions à choix multiples',
    color: '#95E1D3',
    features: [
      '✓ 4 réponses proposées',
      '✓ Auto-généré par IA',
      '✓ Validation automatique',
      '✓ Points selon vitesse'
    ]
  },
  {
    id: 'questions_rafale' as const,
    name: 'Questions en Rafale',
    emoji: '🎬',
    description: 'Indices progressifs',
    color: '#FFD93D',
    features: [
      '✓ Indices toutes les 5s',
      '✓ Bonus si réponse rapide',
      '✓ Buzzer libre',
      '✓ Max 3 indices'
    ]
  },
  {
    id: 'chaud_devant' as const,
    name: 'Chaud Devant',
    emoji: '💣',
    description: 'Patate chaude musicale',
    color: '#FF6B9D',
    features: [
      '✓ Bombe de 30 secondes',
      '✓ Passer à un autre joueur',
      '✓ -15 points à l\'explosion',
      '✓ Stress maximum'
    ]
  },
  {
    id: 'tueurs_gages' as const,
    name: 'Tueurs à Gages',
    emoji: '🎯',
    description: 'Volez les points des adversaires',
    color: '#C44569',
    features: [
      '✓ Cibler un adversaire',
      '✓ Voler 10 points',
      '✓ Stratégie avancée',
      '✓ Alliances possibles'
    ]
  },
  // ====== NOUVEAU MODE À AJOUTER ======
  {
    id: 'trivia' as const,
    name: 'Quiz Culture',
    emoji: '🧠',
    description: 'Questions de culture générale',
    color: '#9C27B0',
    features: [
      '✓ 596 questions variées',
      '✓ QCM 4 réponses',
      '✓ Timer 20 secondes',
      '✓ Validation automatique'
    ]
  }
  // ====================================
] as const;
```

---

## 🎨 Variantes de couleur suggérées

Si le violet ne vous plaît pas, voici d'autres options :

```typescript
color: '#9C27B0'  // Violet (recommandé) - Culture/Connaissance
color: '#3F51B5'  // Indigo - Sérieux/Intelligence
color: '#00BCD4'  // Cyan - Frais/Moderne
color: '#009688'  // Teal - Neutre/Professionnel
color: '#8BC34A'  // Vert clair - Apprentissage
```

---

## 📝 Description alternative

Si vous voulez une description plus détaillée :

```typescript
description: 'Questions de culture générale - Pas de musique, juste des questions !'
// ou
description: 'Testez vos connaissances générales'
// ou
description: 'Histoire, géographie, sciences et plus encore'
```

---

## 🎯 Features alternatives

Si vous voulez mettre l'accent sur d'autres aspects :

```typescript
features: [
  '✓ Histoire, géographie, sciences...',
  '✓ Pas de vitesse, réflexion',
  '✓ API externe (596 questions)',
  '✓ Catégories personnalisables'
]

// ou version courte
features: [
  '✓ 596 questions',
  '✓ QCM 4 choix',
  '✓ 20 secondes',
  '✓ Auto-validation'
]

// ou version détaillée
features: [
  '✓ Questions de culture générale',
  '✓ Choix de la catégorie',
  '✓ 3 niveaux de difficulté',
  '✓ Timer configurable (10-60s)'
]
```

---

## ✅ Checklist après modification

1. [ ] Ouvrir `src/lib/constants.ts`
2. [ ] Ajouter l'objet TRIVIA dans le tableau `GAME_MODES`
3. [ ] Vérifier que `id: 'trivia' as const` correspond au type dans `src/types/game.ts`
4. [ ] Sauvegarder le fichier
5. [ ] Compiler : `npm run build`
6. [ ] Tester en local : `npm run dev`
7. [ ] Vérifier que le mode apparaît dans l'interface
8. [ ] Commit et push

---

## 🚀 Commandes

```bash
# Tester en local
npm run dev

# Compiler
npm run build

# Commit
git add src/lib/constants.ts
git commit -m "feat: add TRIVIA game mode to mode selection"
git push origin main
```

---

## 🔍 Vérification

Après ajout, le mode TRIVIA devrait apparaître dans votre interface avec :
- **Emoji** : 🧠
- **Nom** : Quiz Culture
- **Couleur** : Violet (#9C27B0)
- **4 features** listées

---

## 🐛 Troubleshooting

### Le mode n'apparaît pas
1. Vérifier que le fichier `constants.ts` est bien sauvegardé
2. Redémarrer le serveur dev (`npm run dev`)
3. Vider le cache du navigateur (Ctrl+Shift+R)

### Erreur TypeScript
1. Vérifier que `'trivia'` existe dans le type `GameMode` de `src/types/game.ts`
2. S'assurer d'utiliser `as const` après l'id

### La couleur ne s'affiche pas
1. Vérifier le format HEX : `#9C27B0` (avec #)
2. Essayer une autre couleur du tableau ci-dessus

---

## 📚 Fichiers liés

- **Types** : `src/types/game.ts` - Définition du type `GameMode`
- **Constantes** : `src/lib/constants.ts` - Configuration des modes
- **Composant** : `src/components/modes/ModeCard.tsx` - Affichage des cartes
- **Documentation** : `TRIVIA_MODE.md` - Guide d'implémentation

---

## 💡 Prochaines étapes

Une fois le mode visible :
1. Tester la création d'une partie en mode TRIVIA
2. Vérifier que `load_trivia_questions` est appelé
3. Tester un round complet avec timer
4. Vérifier les sons et animations

---

Bon développement ! 🎉

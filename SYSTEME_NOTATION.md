# Système de notation utilisateur (caché)

## Vue d'ensemble

Un système de scoring automatique a été implémenté pour évaluer la qualité et l'engagement de chaque utilisateur. Ce score est **caché** (non affiché dans l'interface) et sert à classer les utilisateurs en interne.

## Champs Firestore

Chaque utilisateur possède maintenant ces champs additionnels :

```javascript
{
  postsCount: 0,        // Nombre de posts créés
  likesCount: 0,        // Nombre de likes reçus (total)
  userScore: 0,         // Score global (caché)
  engagementRate: 0,    // Taux d'engagement (likes par post)
}
```

## Formule de calcul du score

### Composantes du score

Le score prend en compte **3 métriques** :

1. **Engagement Rate** (Taux d'engagement)
   - Formule : `likesCount / postsCount`
   - Mesure la **qualité** : combien de likes en moyenne par post
   - Exemple : 10 posts avec 50 likes = engagement rate de 5.0

2. **Activity Bonus** (Bonus d'activité)
   - Formule : `log(postsCount + 1)`
   - Mesure l'**activité** de l'utilisateur
   - Utilise un logarithme pour éviter que les gros posteurs dominent trop
   - Exemples :
     - 0 posts → 0
     - 10 posts → 1.04
     - 100 posts → 2.0
     - 1000 posts → 3.0

3. **Normalisation** (par nombre d'utilisateurs)
   - Formule : `/ sqrt(totalUsers)`
   - Plus il y a d'utilisateurs, plus il est difficile d'avoir un score élevé
   - Permet de comparer des scores à différentes étapes de croissance de l'app

### Formule finale

```javascript
userScore = (likesCount / postsCount) * (1 + log(postsCount + 1)) / sqrt(totalUsers)
```

**Simplifiée :**
```
userScore = engagementRate × (1 + activityBonus) / sqrt(totalUsers)
```

## Exemples de scores

Assumons 100 utilisateurs dans l'app (`sqrt(100) = 10`) :

| Posts | Likes | Engagement | Activity Bonus | Score Base | Score Final |
|-------|-------|------------|----------------|------------|-------------|
| 0     | 0     | 0          | 0              | 0          | **0.00**    |
| 5     | 10    | 2.0        | 0.79           | 3.58       | **0.36**    |
| 10    | 30    | 3.0        | 1.04           | 6.12       | **0.61**    |
| 20    | 100   | 5.0        | 1.32           | 11.6       | **1.16**    |
| 50    | 300   | 6.0        | 1.73           | 16.38      | **1.64**    |
| 100   | 500   | 5.0        | 2.00           | 15.0       | **1.50**    |

### Insights :
- **Utilisateur débutant** (5 posts, 10 likes) : Score 0.36
- **Utilisateur actif avec bon engagement** (20 posts, 100 likes) : Score 1.16
- **Gros posteur mais moins de likes** (100 posts, 500 likes) : Score 1.50
  - Même avec 100 posts, le score n'explose pas grâce au logarithme

## Mise à jour automatique

Le score est **automatiquement recalculé** dans ces situations :

1. Quand un utilisateur **crée un post** → `incrementPostsCount()`
2. Quand un utilisateur **reçoit un like** → `incrementLikesCount(userId)`
3. Quand un utilisateur **perd un like** (unlike) → `decrementLikesCount(userId)`

## Fonctions disponibles

### `calculateUserScore(userId)`
Calcule le score sans le sauvegarder

```javascript
import { calculateUserScore } from '../services/authService';

const result = await calculateUserScore('user123');
console.log(result);
// {
//   success: true,
//   score: 1.16,
//   engagementRate: 5.0,
//   metrics: {
//     postsCount: 20,
//     likesCount: 100,
//     activityBonus: 1.32,
//     totalUsers: 100
//   }
// }
```

### `updateUserScore(userId)`
Calcule ET sauvegarde le score dans Firestore

```javascript
import { updateUserScore } from '../services/authService';

const result = await updateUserScore('user123');
// Score automatiquement mis à jour dans Firestore
```

### `getTotalUsersCount()`
Obtenir le nombre total d'utilisateurs

```javascript
import { getTotalUsersCount } from '../services/authService';

const result = await getTotalUsersCount();
console.log(result.count); // 100
```

## Utilisation future

### Classement des utilisateurs

Vous pourrez récupérer les utilisateurs triés par score :

```javascript
// Future fonction
const topUsers = await getTopUsersByScore(limit: 10);
```

### Feed personnalisé

Utiliser le score pour prioriser les posts dans le feed :

```javascript
// Posts d'utilisateurs avec score > 1.0 en premier
// Puis posts d'utilisateurs avec score < 1.0
```

### Badges et récompenses

Déclencher des badges basés sur le score :

```javascript
if (userScore > 2.0) {
  // Débloquer badge "Influenceur"
}
```

### Détection de spam

Identifier les comportements suspects :

```javascript
if (postsCount > 50 && engagementRate < 0.5) {
  // Possible spam : beaucoup de posts, peu de likes
}
```

## Avantages de cette formule

✅ **Équilibre qualité/quantité** : Favorise à la fois l'engagement ET l'activité

✅ **Anti-spam** : Un utilisateur qui poste 1000 fois sans likes aura un score faible

✅ **Évolutif** : Le score s'adapte au nombre d'utilisateurs de l'app

✅ **Juste pour les débutants** : Les nouveaux utilisateurs peuvent avoir un bon score rapidement

✅ **Pas de plafond** : Pas de limite maximale, encourage l'amélioration continue

## Structure Firestore finale

```
users/{userId}/
├── uid: "abc123"
├── email: "user@example.com"
├── firstName: "Jean"
├── lastName: "Dupont"
├── grade: "Touriste"
├── postsCount: 20
├── likesCount: 100
├── userScore: 1.16          ← Score caché
├── engagementRate: 5.0      ← Likes par post
├── preferredLines: [...]
├── createdAt: "2025-01-07T..."
└── updatedAt: "2025-01-07T..."
```

## Attribution automatique des grades

Le grade de l'utilisateur est **automatiquement mis à jour** en fonction de son score caché.

### Paliers de grades

| Grade | Score minimum | Score maximum |
|-------|---------------|---------------|
| **Touriste** | 0.00 | 0.30 |
| **Agent de Bord** | 0.31 | 0.60 |
| **Chef de Quai** | 0.61 | 0.90 |
| **Contrôleur** | 0.91 | 1.20 |
| **Inspecteur Réseau** | 1.21 | 1.50 |
| **Pro du Strapontin** | 1.51 | 1.80 |
| **Dompteur de Navigo** | 1.81 | 2.10 |
| **Sauveur de ligne** | 2.11 | 2.50 |
| **Ministre du transport** | 2.51 | 3.00 |
| **Légende Métropolitaine** | 3.01 | 4.00 |
| **Guide suprême** | 4.01+ | ∞ |

### Fonction `getGradeFromScore(score)`

```javascript
import { getGradeFromScore } from '../services/authService';

const grade = getGradeFromScore(1.5);
console.log(grade); // "Inspecteur Réseau"
```

### Mise à jour automatique

Quand `updateUserScore()` est appelé, le grade est automatiquement recalculé et mis à jour dans Firestore :

```javascript
// L'utilisateur crée un post
await incrementPostsCount();
// → updateUserScore() est appelé automatiquement
// → Le score est recalculé
// → Le grade est mis à jour si nécessaire
```

**Exemples de progression :**

1. Nouvel utilisateur : 0 posts, 0 likes → Score 0.00 → **Touriste**
2. Premier post avec 2 likes : 1 post, 2 likes → Score ~0.35 → **Agent de Bord** ✨
3. 10 posts avec 15 likes : 10 posts, 15 likes → Score ~0.95 → **Contrôleur** ✨
4. 50 posts avec 200 likes : 50 posts, 200 likes → Score ~2.15 → **Sauveur de ligne** ✨

## Note importante

⚠️ Le **score** est **caché** dans l'interface utilisateur. Il n'est **pas affiché** dans ProfileScreen ni ailleurs.

✅ Le **grade** est **affiché** dans ProfileScreen sous forme de badge ⭐.

Le score est une métrique interne pour :
- Déterminer automatiquement le grade
- Classer les utilisateurs
- Personnaliser le feed
- Détecter les comportements suspects
- Décerner des récompenses

---

**Système créé le : 2025-01-07**
**Grades automatiques ajoutés le : 2025-01-07**

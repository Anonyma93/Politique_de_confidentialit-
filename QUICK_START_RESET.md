# Quick Start - Reset automatique des posts

## Résumé rapide

✅ **Objectif** : Supprimer automatiquement tous les posts chaque jour à 4h00 du matin
✅ **Stats préservées** : postsCount, likesCount, userScore, grade
✅ **Coût** : Gratuit (dans les limites du plan Blaze)

---

## Installation en 5 étapes

### 1. Activer le plan Blaze (requis)

```
1. Aller sur https://console.firebase.google.com
2. Sélectionner votre projet
3. Menu "Paramètres" (⚙️) → "Utilisation et facturation"
4. Cliquer sur "Modifier le forfait"
5. Choisir "Plan Blaze (Pay as you go)"
6. Ajouter une carte bancaire

💡 Pas de débit si vous restez dans les limites gratuites (suffisant pour cette app)
```

### 2. Installer Firebase CLI

```bash
npm install -g firebase-tools
```

### 3. Se connecter à Firebase

```bash
cd /Users/quentinmichaud/Desktop/Lini
firebase login
firebase use --add
# Choisir votre projet dans la liste
```

### 4. Installer les dépendances

```bash
cd functions
npm install
cd ..
```

### 5. Déployer la fonction

```bash
firebase deploy --only functions
```

**Résultat attendu :**
```
✔ functions[resetPostsDaily(europe-west1)] Successful create operation.
```

---

## Vérification

### Voir la fonction dans la console

1. [Console Firebase Functions](https://console.firebase.google.com)
2. Menu **"Fonctions"**
3. Vous devriez voir **`resetPostsDaily`** avec :
   - Région : `europe-west1`
   - Planification : `0 4 * * *`
   - Fuseau horaire : `Europe/Paris`

### Voir les logs

```bash
firebase functions:log --only resetPostsDaily
```

Ou dans la console Firebase :
Menu "Fonctions" → Cliquer sur "resetPostsDaily" → Onglet "Logs"

---

## Test rapide (optionnel)

Pour tester sans attendre 4h00 du matin :

### Modifier temporairement le schedule

**Fichier** : `/functions/index.js` ligne 29

```javascript
// Avant (production)
schedule: '0 4 * * *', // Tous les jours à 4h00

// Après (test - toutes les 5 minutes)
schedule: '*/5 * * * *',
```

Redéployer :
```bash
firebase deploy --only functions
```

Attendre 5 minutes et vérifier les logs :
```bash
firebase functions:log --only resetPostsDaily
```

⚠️ **Ne pas oublier de remettre** `'0 4 * * *'` après !

---

## Commandes essentielles

```bash
# Déployer
firebase deploy --only functions

# Voir les logs
firebase functions:log --only resetPostsDaily

# Supprimer la fonction
firebase functions:delete resetPostsDaily

# Lister les fonctions
firebase functions:list
```

---

## Problèmes fréquents

### "Plan Spark ne supporte pas les fonctions planifiées"

➡️ Activer le plan Blaze (étape 1)

### "Permission denied"

```bash
firebase login --reauth
firebase use <project-id>
```

### La fonction ne s'exécute pas

➡️ Attendre 24h (Cloud Scheduler peut prendre du temps)
➡️ Vérifier les logs : `firebase functions:log --only resetPostsDaily`

---

## Documentation complète

Pour plus de détails, voir **`RESET_POSTS_AUTOMATIQUE.md`**

---

**Fonction créée le : 2025-01-08**
**Planification : Tous les jours à 4h00 (heure de Paris)**
**Région : europe-west1**

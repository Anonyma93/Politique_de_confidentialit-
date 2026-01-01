# Reset automatique des posts - Configuration

## Vue d'ensemble

Une **Cloud Function** a été créée pour supprimer automatiquement tous les posts **tous les jours à 4h00 du matin** (heure de Paris).

✅ **Les statistiques utilisateurs sont préservées** :
- `postsCount` : Nombre de posts (historique)
- `likesCount` : Nombre de likes reçus (historique)
- `userScore` : Score de notation
- `engagementRate` : Taux d'engagement
- `grade` : Grade automatique

Seule la collection **`posts`** est vidée quotidiennement.

---

## Prérequis

1. **Firebase CLI** installé globalement :
   ```bash
   npm install -g firebase-tools
   ```

2. **Compte Firebase** avec :
   - ✅ Projet Firebase créé
   - ✅ Firestore activé
   - ✅ **Plan Blaze (Pay as you go)** requis pour Cloud Functions
     - Accéder à : [Console Firebase](https://console.firebase.google.com)
     - Projet → Paramètres → Facturation
     - Passer au plan Blaze

   > ⚠️ **Cloud Functions nécessite le plan Blaze** (payant)
   > Mais les coûts sont généralement très faibles :
   > - Fonction exécutée 1 fois par jour
   > - ~100ms d'exécution
   > - Coût estimé : **< 0.01€ par mois**

---

## Installation

### 1. Connexion à Firebase

```bash
# Se connecter à Firebase
firebase login

# Initialiser le projet (si pas déjà fait)
cd /Users/quentinmichaud/Desktop/Lini
firebase init functions
```

**Pendant l'initialisation, choisir :**
- **Language** : JavaScript
- **ESLint** : Non (optionnel)
- **Installer les dépendances maintenant** : Oui

> ⚠️ Si le dossier `functions/` existe déjà, Firebase vous demandera de confirmer l'écrasement.
> Répondre **Non** pour garder nos fichiers.

### 2. Installer les dépendances

```bash
cd functions
npm install
```

---

## Déploiement

### Option 1 : Déployer uniquement la fonction

```bash
# Depuis la racine du projet
firebase deploy --only functions
```

### Option 2 : Déployer toutes les fonctions

```bash
firebase deploy --only functions
```

**Résultat attendu :**
```
✔ functions[resetPostsDaily(europe-west1)] Successful create operation.
Function URL: https://europe-west1-<project-id>.cloudfunctions.net/resetPostsDaily
```

---

## Vérification du déploiement

### 1. Vérifier dans la console Firebase

1. Aller sur [Console Firebase Functions](https://console.firebase.google.com)
2. Sélectionner votre projet
3. Menu **"Fonctions"** (Functions)
4. Vous devriez voir : **`resetPostsDaily`**

**Informations affichées :**
- **Région** : `europe-west1` (proche de Paris)
- **Déclencheur** : Planification (Schedule)
- **Cron** : `0 4 * * *`
- **Fuseau horaire** : `Europe/Paris`
- **Dernière exécution** : (affichera la date après la première exécution)

### 2. Vérifier les logs

```bash
# Afficher les logs en temps réel
firebase functions:log --only resetPostsDaily

# Ou depuis la console Firebase
# Menu "Fonctions" → Cliquer sur "resetPostsDaily" → Onglet "Logs"
```

---

## Test manuel (optionnel)

Pour tester la fonction **sans attendre 4h00 du matin** :

### Option 1 : Via Firebase CLI

```bash
firebase functions:shell
```

Puis dans le shell :
```javascript
resetPostsDaily()
```

### Option 2 : Modifier temporairement le schedule

Dans `/functions/index.js`, ligne 29 :
```javascript
schedule: '*/5 * * * *', // Test : toutes les 5 minutes
```

Redéployer :
```bash
firebase deploy --only functions
```

⚠️ **Ne pas oublier de remettre** `'0 4 * * *'` après les tests !

---

## Monitoring

### Consulter les logs d'exécution

**Depuis la console Firebase :**
1. Menu **"Fonctions"**
2. Cliquer sur **`resetPostsDaily`**
3. Onglet **"Logs"**

**Logs attendus lors d'une exécution réussie :**
```
🔄 Démarrage du reset quotidien des posts...
⏰ Heure d'exécution: 2025-01-08T03:00:00.000Z
📦 Exécution de 1 batch(es) de suppression...
✅ Reset terminé avec succès
🗑️ 42 posts supprimés
👥 Les statistiques utilisateurs sont préservées
```

### Alertes en cas d'erreur

Firebase envoie automatiquement des emails si la fonction échoue plusieurs fois de suite.

---

## Fréquence d'exécution

| Expression Cron | Description |
|----------------|-------------|
| `0 4 * * *` | **Actuel** : Tous les jours à 4h00 |
| `0 3 * * *` | Tous les jours à 3h00 |
| `0 5 * * *` | Tous les jours à 5h00 |
| `0 4 * * 1` | Tous les lundis à 4h00 |
| `0 4 1 * *` | Le 1er de chaque mois à 4h00 |

**Format Cron :**
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Jour de la semaine (0-6, 0=Dimanche)
│ │ │ └─── Mois (1-12)
│ │ └───── Jour du mois (1-31)
│ └─────── Heure (0-23)
└───────── Minute (0-59)
```

Pour changer la fréquence, modifier la ligne 29 dans `/functions/index.js` et redéployer.

---

## Coûts estimés

### Plan Blaze (Pay as you go)

**Cloud Functions pricing :**
- **Invocations** : 2 millions gratuits / mois
  - Notre fonction : 30 invocations / mois → **Gratuit**
- **Temps de calcul** : 400,000 GB-secondes gratuits / mois
  - Notre fonction : ~100ms × 30 = 3 secondes / mois → **Gratuit**
- **Trafic réseau** : 5 GB sortant gratuits / mois
  - Notre fonction : ~1 KB × 30 = 30 KB / mois → **Gratuit**

**Cloud Scheduler pricing :**
- **Jobs** : 3 gratuits / mois
  - Notre fonction : 1 job → **Gratuit**

**Coût total estimé : 0.00€ / mois** (dans les limites gratuites)

> ℹ️ Même en dépassant les limites, le coût reste minimal :
> - 1 million d'invocations supplémentaires : 0.40$
> - 1 million GB-secondes supplémentaires : 0.0000025$

---

## Troubleshooting

### Erreur : "Plan Spark ne supporte pas les fonctions planifiées"

**Solution :**
1. Aller sur [Console Firebase](https://console.firebase.google.com)
2. Projet → Paramètres → Facturation
3. Passer au **Plan Blaze**
4. Ajouter une carte bancaire (pas de débit si vous restez dans les limites gratuites)

### Erreur : "Permission denied" lors du déploiement

**Solution :**
```bash
# Se reconnecter
firebase login --reauth

# Vérifier le projet actif
firebase projects:list
firebase use <project-id>
```

### La fonction ne s'exécute pas à l'heure prévue

**Vérifications :**
1. Vérifier le fuseau horaire dans `/functions/index.js` ligne 30
2. Vérifier les logs : `firebase functions:log --only resetPostsDaily`
3. Attendre 24h (Cloud Scheduler peut prendre du temps à se synchroniser)

### Erreur : "DEADLINE_EXCEEDED" dans les logs

**Cause :** Trop de posts à supprimer (timeout)

**Solution :** Augmenter le timeout dans `/functions/index.js` ligne 28 :
```javascript
exports.resetPostsDaily = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'Europe/Paris',
    memory: '512MiB', // Augmenter la mémoire
    timeoutSeconds: 300, // Ajouter un timeout de 5 minutes
    region: 'europe-west1',
  },
  // ...
);
```

### Les statistiques utilisateurs ont été supprimées

**Cause :** Bug dans la fonction (ne devrait pas arriver)

**Solution préventive :** Faire des backups réguliers de Firestore
```bash
# Via Firebase CLI
firebase firestore:backup gs://<bucket-name>
```

**Solution curative :** Restaurer depuis un backup

---

## Désactivation temporaire

Pour **désactiver temporairement** le reset quotidien sans supprimer la fonction :

### Option 1 : Supprimer le déploiement

```bash
firebase functions:delete resetPostsDaily
```

### Option 2 : Commenter le code

Dans `/functions/index.js`, commenter l'export :
```javascript
// exports.resetPostsDaily = onSchedule(
//   ...
// );
```

Puis redéployer :
```bash
firebase deploy --only functions
```

---

## Architecture technique

### Fonctionnement de la suppression

```javascript
1. Cloud Scheduler déclenche la fonction à 4h00 (Europe/Paris)
   ↓
2. La fonction récupère tous les documents de 'posts'
   ↓
3. Suppression par batch (max 500 par batch)
   ↓
4. Commit de tous les batches en parallèle
   ↓
5. Logs du résultat (nombre de posts supprimés)
```

### Sécurité

- ✅ Suppression uniquement de la collection `posts`
- ✅ Aucune modification de la collection `users`
- ✅ Logs détaillés de chaque exécution
- ✅ Pas de retry automatique en cas d'erreur (évite les boucles)

### Performance

- **Batch size** : 500 opérations / batch (limite Firestore)
- **Parallélisation** : Tous les batches sont exécutés simultanément
- **Mémoire** : 256 MiB allouée
- **Timeout** : 60 secondes par défaut (configurable)

**Capacité :**
- 500 posts : ~1 seconde
- 5,000 posts : ~3 secondes
- 50,000 posts : ~30 secondes

---

## Commandes utiles

```bash
# Déployer la fonction
firebase deploy --only functions

# Supprimer la fonction
firebase functions:delete resetPostsDaily

# Voir les logs
firebase functions:log --only resetPostsDaily

# Lister toutes les fonctions
firebase functions:list

# Tester localement avec l'émulateur
firebase emulators:start --only functions

# Voir les coûts
# Aller sur : https://console.firebase.google.com → Projet → Usage and billing
```

---

## Support

**Documentation officielle :**
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs)
- [Cron expression syntax](https://crontab.guru/)

**En cas de problème :**
1. Vérifier les logs : `firebase functions:log`
2. Vérifier la console Firebase : [Console Functions](https://console.firebase.google.com)
3. Vérifier le plan Blaze est actif

---

**Système créé le : 2025-01-08**
**Fonction : `resetPostsDaily`**
**Région : `europe-west1`**
**Planification : Tous les jours à 4h00 (Europe/Paris)**

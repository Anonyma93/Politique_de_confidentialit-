# 🔒 Documentation de Sécurité - Lini

## Vue d'ensemble

Ce document détaille toutes les mesures de sécurité mises en place dans l'application Lini pour protéger les données des utilisateurs et prévenir les abus.

---

## ✅ Mesures de sécurité implémentées

### 1. Règles de sécurité Firestore

**Fichier**: `firestore.rules`

#### Collection `users`
- ✅ **Lecture** : Tous les utilisateurs authentifiés peuvent lire les profils
- ✅ **Création** : Uniquement son propre profil avec validation des champs
- ✅ **Modification** : Uniquement son propre profil
- ✅ **Protection** : Les champs sensibles ne peuvent PAS être modifiés par l'utilisateur :
  - `isPremium`, `premiumExpiresAt`
  - `postsCount`, `likesCount`, `likesGiven`
  - `userScore`, `engagementRate`
  - `createdAt`, `email`
- ✅ **Suppression** : Interdite (utiliser Cloud Functions ou Firebase Auth)

#### Collection `posts`
- ✅ **Lecture** : Public (tout le monde)
- ✅ **Création** : Utilisateurs authentifiés uniquement
- ✅ **Validation stricte** :
  - Ligne : 1-50 caractères
  - Station : 1-100 caractères
  - Commentaire : 1-500 caractères
  - Gravité : valeurs prédéfinies uniquement
  - Type : 'incident' ou 'information' uniquement
- ✅ **Modification** : Uniquement pour les likes et confirmations
  - Validation atomique des compteurs
  - Vérification de cohérence des tableaux
- ✅ **Suppression** : Uniquement ses propres posts

#### Collection `comments`
- ✅ **Lecture** : Public
- ✅ **Création** : Utilisateurs authentifiés avec validation
  - Texte : 1-500 caractères
  - Vérification que le post existe
- ✅ **Modification** : Interdite (commentaires immutables)
- ✅ **Suppression** : Uniquement ses propres commentaires

### 2. Validation côté client

**Fichier**: `utils/validation.js`

#### Fonctions de validation
- ✅ `validatePost(postData)` : Valide tous les champs d'un post
- ✅ `validateComment(text)` : Valide le texte d'un commentaire
- ✅ `validateUserName(name)` : Valide les noms d'utilisateur
- ✅ `validateEmail(email)` : Valide les adresses email

#### Sanitization (protection XSS)
- ✅ `sanitizeText(text)` : Échappe les caractères dangereux
  - `<` → `&lt;`
  - `>` → `&gt;`
  - `"` → `&quot;`
  - `'` → `&#x27;`
  - `/` → `&#x2F;`
- ✅ `sanitizePostData(postData)` : Sanitize tous les champs d'un post
- ✅ `containsSuspiciousContent(text)` : Détecte les patterns malveillants
  - Balises `<script>`
  - Protocole `javascript:`
  - Event handlers (`onclick`, etc.)
  - `eval()`, accès à `document` ou `window`
  - Iframes, embeds, objects

### 3. Implémentation dans PostScreen

**Fichier**: `screens/PostScreen.js`

```javascript
// Vérification du contenu suspect
if (containsSuspiciousContent(postData.comment) ||
    containsSuspiciousContent(postData.incident)) {
  Alert.alert('Erreur', 'Le contenu semble contenir des éléments suspects.');
  return;
}

// Validation des données
const validation = validatePost(postData);
if (!validation.valid) {
  Alert.alert('Erreur de validation', validation.error);
  return;
}

// Sanitization
postData = sanitizePostData(postData);
```

### 4. Implémentation dans CommentService

**Fichier**: `services/commentService.js`

```javascript
// Validation du texte
const validation = validateComment(text);
if (!validation.valid) {
  return { success: false, error: validation.error };
}

// Vérification du contenu suspect
if (containsSuspiciousContent(text)) {
  return { success: false, error: 'Le commentaire contient des éléments suspects' };
}

// Sanitization
const sanitizedText = sanitizeText(text);
```

---

## 🛡️ Protection contre les vulnérabilités

### XSS (Cross-Site Scripting)
- ✅ Sanitization de tous les inputs utilisateur
- ✅ Détection de contenu suspect
- ✅ Échappement des caractères HTML

### Injection SQL
- ✅ N/A (Firestore est NoSQL et sécurisé par nature)

### CSRF (Cross-Site Request Forgery)
- ✅ Authentification Firebase (tokens sécurisés)
- ✅ Vérification de l'identité de l'utilisateur dans les règles

### Manipulation de données
- ✅ Règles Firestore empêchent la modification des champs sensibles
- ✅ Validation stricte des types et longueurs
- ✅ Vérification de cohérence des compteurs

### Spam / Abus
- ✅ Limites de longueur sur tous les champs texte
- ✅ Validation des valeurs prédéfinies (severity, type)
- ⚠️ **À implémenter** : Rate limiting (max 1 post/30s)

### Accès non autorisé
- ✅ Authentification requise pour la plupart des opérations
- ✅ Vérification que l'utilisateur est propriétaire des ressources
- ✅ Isolation des données sensibles

---

## ⚠️ Limitations connues

### 1. Rate Limiting
**Status**: Préparé mais non actif

Les règles Firestore incluent une fonction `canCreatePost()` pour limiter à 1 post toutes les 30 secondes, mais elle nécessite un document `users/{uid}/lastPost` qui n'est pas encore créé par l'application.

**Pour activer** :
```javascript
// Dans PostScreen.js, après création d'un post
await setDoc(doc(db, 'users', user.uid, 'lastPost'), {
  timestamp: new Date()
});
```

### 2. Modération de contenu
**Status**: Non implémenté

Actuellement, il n'y a pas de modération automatique ou manuelle des posts/commentaires.

**Recommandations** :
- Implémenter un système de signalement
- Ajouter une queue de modération
- Utiliser une API de détection de contenu inapproprié

### 3. Tokens de notification
**Status**: Stockés en clair

Les tokens Expo Push sont stockés dans Firestore et lisibles par tous les utilisateurs authentifiés.

**Impact** : Faible (les tokens seuls ne permettent pas d'envoyer des notifications)

---

## 📋 Checklist de sécurité

### Fait ✅
- [x] Règles de sécurité Firestore configurées
- [x] Validation des données côté client
- [x] Sanitization contre XSS
- [x] Protection des champs sensibles
- [x] Authentification requise
- [x] Vérification de propriété des ressources
- [x] Limites de longueur sur les textes
- [x] Détection de contenu suspect

### À faire 📝
- [ ] Activer le rate limiting
- [ ] Implémenter un système de signalement
- [ ] Ajouter une modération de contenu
- [ ] Chiffrer les données sensibles au repos
- [ ] Implémenter des logs de sécurité
- [ ] Ajouter des tests de sécurité automatisés
- [ ] Configurer des alertes pour activités suspectes

---

## 🔐 Bonnes pratiques pour les développeurs

### Avant de déployer
1. ✅ Tester les règles Firestore avec l'émulateur
2. ✅ Vérifier que tous les inputs sont validés
3. ✅ S'assurer que la sanitization est appliquée
4. ✅ Tester les cas limites (texte vide, très long, etc.)

### Ajout de nouvelles fonctionnalités
1. ⚠️ Toujours ajouter des règles Firestore pour les nouvelles collections
2. ⚠️ Valider TOUS les inputs utilisateur
3. ⚠️ Sanitize les données avant l'affichage
4. ⚠️ Tester les scénarios d'abus

### Gestion des secrets
- ✅ Les clés API Firebase côté client sont PUBLIQUES (c'est normal)
- ✅ La sécurité repose sur les règles Firestore et l'authentification
- ⚠️ Ne JAMAIS exposer de clés privées ou secrets serveur

---

## 📞 En cas de problème de sécurité

Si vous découvrez une faille de sécurité :

1. **NE PAS** la divulguer publiquement
2. Documenter le problème en détail
3. Créer un patch si possible
4. Tester le correctif
5. Déployer en urgence si critique

---

## 📚 Ressources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

**Dernière mise à jour** : 2026-01-11
**Version de sécurité** : 1.0.0

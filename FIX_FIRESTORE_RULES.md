# Corriger les règles Firestore - Blocage inscription

## 🐛 Problème

Vous voyez cette erreur et la page reste bloquée :
```
WebChannelConnection RPC 'Write' stream transport errored
```

Le compte se crée dans **Authentication** mais pas dans **Firestore Database**.

## ✅ Solution rapide (5 minutes)

### Étape 1 : Vérifier que Firestore est activé

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **lini-47633**
3. Menu de gauche : **Firestore Database**
4. **Si vous voyez "Créer une base de données"** :
   - Cliquez dessus
   - Sélectionnez **Mode test** (très important !)
   - Localisation : **europe-west**
   - Cliquez sur **Activer**
   - Attendez que Firestore soit créé (30-60 secondes)

### Étape 2 : Configurer les règles en mode test

Une fois Firestore activé :

1. Cliquez sur l'onglet **Rules** (Règles)
2. **Supprimez TOUT** le contenu actuel
3. **Copiez-collez** ce code :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Mode TEST - Tout le monde peut lire et écrire
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

4. Cliquez sur **Publier**
5. Vous devriez voir : "✓ Vos règles ont été publiées"

⚠️ **IMPORTANT** : Ces règles sont pour le **développement uniquement** !

### Étape 3 : Tester à nouveau

1. Retournez dans votre app
2. Créez un nouveau compte
3. ✅ La page devrait maintenant passer à l'écran principal !

### Étape 4 : Vérifier dans Firebase

1. Firebase Console → **Authentication** → **Users**
   - Vous devriez voir votre compte
2. Firebase Console → **Firestore Database** → **Data**
   - Vous devriez voir une collection **users**
   - Cliquez dessus pour voir vos données

## 🔒 Règles sécurisées (pour plus tard)

Une fois que tout fonctionne en mode test, remplacez par ces règles plus sécurisées :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Collection users
    match /users/{userId} {
      // Lecture : tous les utilisateurs connectés
      allow read: if request.auth != null;

      // Écriture : seulement son propre profil
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Cliquez sur **Publier**.

## 🐛 Dépannage

### "Règles non valides"
→ Vérifiez qu'il n'y a pas de faute de frappe
→ Copiez-collez exactement le code ci-dessus

### L'erreur persiste
→ Attendez 30 secondes après avoir publié les règles
→ Rechargez votre app
→ Vérifiez que vous êtes bien en **mode test**

### "Permission denied"
→ Vérifiez que les règles sont bien publiées
→ Essayez les règles en mode test (allow read, write: if true)

### Le compte n'apparaît pas dans Firestore
→ C'est normal si Firestore a timeout
→ Le compte existe dans Authentication
→ Vous pouvez quand même vous connecter
→ Une fois Firestore configuré, reconnectez-vous et le document sera créé

## 🎯 Ce qui a changé dans le code

J'ai modifié le code pour que **l'inscription continue même si Firestore échoue** :

- Timeout de 10 secondes pour l'écriture Firestore
- Si Firestore échoue, l'utilisateur est quand même créé
- Vous pouvez vous connecter même sans Firestore
- Le document sera créé lors de la prochaine connexion

## ⏱️ Mode test - Expiration

**ATTENTION** : Le mode test expire après **30 jours**.

Dans 30 jours, vous verrez cette notification dans Firebase Console :
```
Your security rules are defined as public, so anyone can read or write your data
```

Avant l'expiration, passez aux règles sécurisées ci-dessus.

## ✅ Checklist complète Firebase

Pour que tout fonctionne :

- [ ] **Firestore Database** activé en **mode test**
- [ ] **Règles Firestore** publiées (allow read, write: if true)
- [ ] **Authentication** activé avec Email/Password
- [ ] Tester la création d'un compte
- [ ] Vérifier dans Firestore que le document user est créé

## 📞 Encore des problèmes ?

Si après avoir suivi ce guide, ça ne fonctionne toujours pas :

1. Vérifiez la console du navigateur/app pour les erreurs
2. Vérifiez que vous êtes bien dans le projet **lini-47633**
3. Vérifiez que les règles sont bien publiées
4. Attendez 30-60 secondes après avoir activé Firestore
5. Relancez complètement l'app

## 💡 Astuce

Pour vérifier rapidement que Firestore fonctionne :

1. Firebase Console → Firestore Database
2. Cliquez sur **+ Start collection**
3. Collection ID : `test`
4. Document ID : laissez auto
5. Champ : `working` / Type : `string` / Valeur : `yes`
6. Cliquez sur **Save**

Si vous pouvez créer ce document, Firestore fonctionne !

---

**Une fois configuré, tout devrait fonctionner parfaitement !** 🎉

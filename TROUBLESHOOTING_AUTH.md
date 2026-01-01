# Résolution des problèmes d'authentification

## Erreur : "Cet email est déjà utilisé"

Cette erreur se produit quand vous essayez de créer un compte avec un email qui existe déjà dans Firebase.

### Solution 1 : Essayer de se connecter

Si vous avez déjà créé un compte avec cet email :

1. Allez sur la page de **Connexion** (bouton "Se connecter" en bas de la page d'inscription)
2. Entrez votre email et mot de passe
3. Cliquez sur "Se connecter"

### Solution 2 : Utiliser un autre email

Créez un compte avec une adresse email différente.

### Solution 3 : Supprimer le compte existant (si vous ne vous souvenez plus du mot de passe)

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet **lini-47633**
3. Menu de gauche : **Authentication**
4. Si vous voyez "Commencer", cliquez dessus pour activer Authentication
5. Activez **Email/Password** dans l'onglet **Sign-in method**
6. Allez dans l'onglet **Users**
7. Trouvez votre email dans la liste
8. Cliquez sur les 3 points verticaux ⋮ à droite
9. Sélectionnez **Delete account**
10. Confirmez la suppression

Ensuite, retournez dans l'app et recréez votre compte.

## Vérifier que Authentication est activé

Pour que l'app fonctionne, vous devez activer Firebase Authentication :

1. [Firebase Console](https://console.firebase.google.com/) → projet **lini-47633**
2. Menu **Authentication** → **Commencer**
3. Onglet **Sign-in method**
4. Cliquez sur **Email/Password**
5. Activez le bouton **Activer**
6. Cliquez sur **Enregistrer**

## Vérifier que Firestore est activé

1. Menu **Firestore Database** → **Créer une base de données**
2. Mode **test** (pour le développement)
3. Localisation : **europe-west**
4. Cliquez sur **Activer**

### Règles Firestore (optionnel mais recommandé)

Dans **Firestore > Règles** :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Autres erreurs courantes

### "Le mot de passe est trop faible"
→ Utilisez au moins 6 caractères pour votre mot de passe

### "L'adresse email n'est pas valide"
→ Vérifiez le format de votre email (doit contenir @)

### "Trop de tentatives"
→ Attendez quelques minutes avant de réessayer

### "Erreur de connexion"
→ Vérifiez votre connexion internet

## Checklist complète Firebase

Pour que l'app fonctionne complètement :

- [ ] Firebase configuré dans `config/firebase.js` ✅ (déjà fait)
- [ ] **Authentication** activé avec Email/Password
- [ ] **Firestore Database** créé en mode test
- [ ] **Storage** activé (optionnel, pour les photos)
- [ ] Règles Firestore configurées
- [ ] Règles Storage configurées (si vous voulez les photos)

## Test complet

1. **Créer un compte** :
   - Utilisez un email unique
   - Mot de passe minimum 6 caractères
   - Remplissez tous les champs
   - (La photo est optionnelle)

2. **Se connecter** :
   - Utilisez le même email et mot de passe
   - Vous devriez accéder à l'app

3. **Vérifier dans Firebase** :
   - Allez dans Authentication > Users
   - Vous devriez voir votre compte
   - Allez dans Firestore Database > users
   - Vous devriez voir votre document utilisateur

## Support

Si vous avez toujours des problèmes :

1. Vérifiez la console de votre navigateur ou l'app pour les erreurs détaillées
2. Vérifiez que tous les services Firebase sont activés
3. Essayez avec un email complètement différent
4. Redémarrez l'application

Les messages d'erreur sont maintenant en français et vous guident vers la solution !

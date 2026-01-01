# Configuration Firebase pour Lini

## Étapes pour configurer Firebase

### 1. Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur "Ajouter un projet"
3. Donnez un nom à votre projet (ex: "Lini")
4. Suivez les étapes de création

### 2. Ajouter une application Web

1. Dans votre projet Firebase, cliquez sur l'icône Web `</>`
2. Donnez un nom à votre application (ex: "Lini App")
3. Copiez la configuration Firebase qui s'affiche

### 3. Activer l'authentification

1. Dans le menu de gauche, allez dans **Authentication**
2. Cliquez sur **Commencer**
3. Dans l'onglet **Sign-in method**, activez :
   - **Email/Password** (cliquez dessus et activez)

### 4. Créer la base de données Firestore

1. Dans le menu de gauche, allez dans **Firestore Database**
2. Cliquez sur **Créer une base de données**
3. Choisissez le mode :
   - **Mode test** (pour le développement) - données accessibles pendant 30 jours
   - **Mode production** (avec règles de sécurité personnalisées)
4. Choisissez la localisation (ex: europe-west)

### 5. Activer Firebase Storage

1. Dans le menu de gauche, allez dans **Storage**
2. Cliquez sur **Commencer**
3. Acceptez les règles de sécurité par défaut (mode test)

### 6. Configurer votre application

Ouvrez le fichier `config/firebase.js` et remplacez la configuration par défaut par celle que vous avez copiée à l'étape 2 :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "votre-projet.firebaseapp.com",
  projectId: "votre-projet",
  storageBucket: "votre-projet.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### 7. Règles de sécurité Firestore (optionnel mais recommandé)

Dans **Firestore Database > Règles**, remplacez par :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Règles pour les utilisateurs
    match /users/{userId} {
      // Permet la lecture uniquement si c'est son propre profil ou tous les utilisateurs connectés
      allow read: if request.auth != null;
      // Permet l'écriture uniquement sur son propre profil
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 8. Règles de sécurité Storage (optionnel mais recommandé)

Dans **Storage > Règles**, remplacez par :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{userId}.jpg {
      // Permet la lecture à tous les utilisateurs connectés
      allow read: if request.auth != null;
      // Permet l'écriture uniquement pour son propre profil
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Structure de données dans Firestore

Votre base de données aura cette structure :

```
users (collection)
  └── {userId} (document)
      ├── uid: string
      ├── email: string
      ├── firstName: string
      ├── lastName: string
      ├── photoURL: string (URL de la photo dans Storage)
      ├── preferredLines: string
      ├── createdAt: string (ISO date)
      └── updatedAt: string (ISO date)
```

## Utilisation dans l'application

### S'inscrire
- L'utilisateur remplit le formulaire d'inscription
- Une photo de profil peut être uploadée
- Les données sont sauvegardées dans Authentication et Firestore

### Se connecter
- L'utilisateur entre son email et mot de passe
- Firebase Authentication vérifie les identifiants

### Récupérer les données utilisateur
```javascript
import { getUserData } from '../services/authService';

const { success, data } = await getUserData(userId);
if (success) {
  console.log(data); // Informations de l'utilisateur
}
```

## Dépannage

Si vous rencontrez des erreurs :

1. **Erreur d'authentification** : Vérifiez que Email/Password est activé dans Authentication
2. **Erreur Firestore** : Vérifiez que Firestore Database est créé
3. **Erreur Storage** : Vérifiez que Storage est activé
4. **Permission denied** : Vérifiez les règles de sécurité

## Notes importantes

⚠️ **Mode test** : Les règles en mode test expirent après 30 jours. Pensez à les mettre à jour !

🔒 **Sécurité** : Ne commitez JAMAIS votre fichier `firebase.js` avec les vraies clés dans un dépôt public.
Ajoutez `config/firebase.js` dans votre `.gitignore` en production.

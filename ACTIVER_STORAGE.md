# Comment activer les photos de profil (Firebase Storage)

## 🚀 Guide rapide - 5 minutes

### Étape 1 : Ouvrir Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **lini-47633**

### Étape 2 : Activer Storage

1. Dans le menu de gauche, cliquez sur **Storage**
2. Cliquez sur le bouton **Commencer**
3. Une fenêtre s'ouvre : **Règles de sécurité**
   - Sélectionnez **Démarrer en mode test**
   - Cliquez sur **Suivant**
4. **Emplacement Cloud Storage**
   - Sélectionnez : **europe-west** (ou la région la plus proche)
   - Cliquez sur **Terminé**

✅ Storage est maintenant activé !

### Étape 3 : Configurer les règles (pour autoriser les uploads)

1. Vous êtes maintenant dans Storage
2. Cliquez sur l'onglet **Rules** (Règles) en haut
3. **Supprimez tout** le contenu actuel
4. **Copiez-collez** ce code :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

5. Cliquez sur **Publier**

✅ Les règles sont configurées !

### Étape 4 : Tester dans l'app

1. Retournez dans votre application
2. Créez un nouveau compte
3. **Sélectionnez une photo** cette fois-ci
4. Remplissez les autres champs
5. Cliquez sur **S'inscrire**

🎉 La photo devrait s'uploader avec succès !

## ✅ Vérification

Pour vérifier que ça fonctionne :

1. Dans Firebase Console → Storage → Files
2. Vous devriez voir un dossier **profile-photos**
3. À l'intérieur, votre photo devrait apparaître

## 🔒 Explication des règles

```javascript
allow read: if true;
// → Tout le monde peut VOIR les photos de profil (publiques)

allow write: if request.auth != null;
// → Seuls les utilisateurs CONNECTÉS peuvent uploader des photos
```

## 🛡️ Règles plus sécurisées (recommandé pour production)

Une fois que vous voulez passer en production, utilisez ces règles plus strictes :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{userId}.jpg {
      // Seuls les utilisateurs connectés peuvent lire
      allow read: if request.auth != null;

      // Seul le propriétaire peut modifier sa photo
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024  // Max 5MB
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

## ❓ Problèmes courants

### "Permission denied"
→ Vérifiez que les règles Storage sont bien publiées

### "Storage bucket not found"
→ Vérifiez que Storage est activé

### "Quota exceeded"
→ Vous avez atteint la limite gratuite de Firebase (5GB)

## 📊 Limites du plan gratuit Firebase

- **Storage** : 5 GB
- **Téléchargements** : 1 GB/jour
- **Uploads** : Illimités

Largement suffisant pour débuter ! 🚀

---

**C'est tout !** Les photos de profil fonctionnent maintenant dans votre app.

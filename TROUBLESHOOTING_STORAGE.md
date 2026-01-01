# Résolution des problèmes Firebase Storage

## Erreur: "Firebase Storage: An unknown error occurred"

Cette erreur signifie que Firebase Storage n'est pas correctement configuré. Voici comment la résoudre :

### Étape 1 : Vérifier que Storage est activé

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet **lini-47633**
3. Dans le menu de gauche, cliquez sur **Storage**
4. Si vous voyez "Commencer", cliquez dessus pour activer Storage
5. Choisissez **Mode test** (pour le développement)
6. Sélectionnez la localisation : **europe-west**
7. Cliquez sur **Terminé**

### Étape 2 : Configurer les règles Storage

Une fois Storage activé :

1. Cliquez sur l'onglet **Rules** (Règles)
2. Remplacez le contenu par ce code :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Permettre la lecture et l'écriture de photos de profil
    match /profile-photos/{allPaths=**} {
      allow read: if true;  // Tout le monde peut lire (photos publiques)
      allow write: if request.auth != null;  // Seuls les utilisateurs connectés peuvent écrire
    }
  }
}
```

3. Cliquez sur **Publier**

### Étape 3 : Vérifier le bucket Storage

1. Vérifiez que le bucket dans votre configuration Firebase (`lini-47633.firebasestorage.app`) est correct
2. Il doit correspondre au nom affiché dans **Storage > Files**

### Étape 4 : Tester sans photo

L'application a été mise à jour pour fonctionner **même sans photo** :
- Si l'upload de photo échoue, l'inscription continue sans photo
- Vous pouvez créer un compte sans sélectionner de photo
- La photo pourra être ajoutée plus tard

### Étape 5 : Test complet

Pour tester que tout fonctionne :

1. **Créer un compte SANS photo** :
   - Remplissez tous les champs sauf la photo
   - Cliquez sur "S'inscrire"
   - Ça devrait fonctionner ✅

2. **Créer un compte AVEC photo** (une fois Storage activé) :
   - Sélectionnez une photo
   - Remplissez tous les champs
   - Cliquez sur "S'inscrire"
   - La photo devrait s'uploader ✅

## Règles Storage plus restrictives (recommandé pour production)

Pour plus de sécurité en production :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{userId}.jpg {
      // Tout le monde peut lire les photos de profil
      allow read: if request.auth != null;

      // Seul le propriétaire peut uploader/modifier sa photo
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024  // Max 5MB
                   && request.resource.contentType.matches('image/.*');  // Images seulement
    }
  }
}
```

## Vérifications finales

Checklist pour Storage :

- [ ] Storage est activé dans Firebase Console
- [ ] Les règles Storage sont configurées
- [ ] Le bucket `lini-47633.firebasestorage.app` existe
- [ ] Vous pouvez créer un compte sans photo
- [ ] Vous pouvez créer un compte avec photo (après activation Storage)

## Note importante

L'application fonctionne maintenant **avec ou sans photo**. Si vous avez des problèmes avec Storage :
1. Créez d'abord des comptes sans photo
2. Configurez Storage
3. Ajoutez les photos après

Les erreurs Storage sont maintenant **non bloquantes** pour l'inscription.

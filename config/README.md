# Configuration Firebase

## Configuration rapide

1. **Copiez le fichier template** :
   ```bash
   cp firebase.example.js firebase.js
   ```

2. **Obtenez vos clés Firebase** :
   - Allez sur [Firebase Console](https://console.firebase.google.com/)
   - Créez ou sélectionnez votre projet
   - Ajoutez une application Web
   - Copiez la configuration

3. **Mettez à jour `firebase.js`** avec vos clés :
   ```javascript
   const firebaseConfig = {
     apiKey: "VOS_VRAIES_CLES_ICI",
     authDomain: "votre-projet.firebaseapp.com",
     // ... etc
   };
   ```

4. **Vérifiez** que `firebase.js` est dans `.gitignore` (déjà fait !)

## Fichiers

- `firebase.example.js` : Template à copier (versionné dans git)
- `firebase.js` : Votre configuration réelle (ne PAS commit en production)
- `README.md` : Ce fichier

## Voir aussi

Consultez `FIREBASE_SETUP.md` à la racine du projet pour le guide complet de configuration Firebase.

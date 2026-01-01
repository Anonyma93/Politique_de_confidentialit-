# Configuration Sign in with Apple

Ce guide vous aide à configurer **Sign in with Apple** pour votre application Lini.

## ⚠️ Prérequis

Avant de commencer, vous devez avoir :

1. **Un compte Apple Developer** (99$/an)
   - Inscrivez-vous sur [developer.apple.com](https://developer.apple.com)
   - Si vous n'en avez pas, vous pouvez continuer à utiliser Email/Password

2. **Un Mac** (recommandé pour certaines étapes)

3. **Votre projet Firebase** déjà configuré

## 🚀 Étape 1 : Activer Sign in with Apple dans Firebase

### 1.1 Ouvrir Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **lini-47633**

### 1.2 Activer Apple comme fournisseur

1. Menu de gauche : **Authentication**
2. Onglet **Sign-in method**
3. Cliquez sur **Apple**
4. Activez le bouton **Activer**
5. **NE PAS SAUVEGARDER ENCORE** - gardez cette page ouverte

## 🍎 Étape 2 : Configurer dans Apple Developer Console

### 2.1 Créer un App ID

1. Allez sur [Apple Developer Console](https://developer.apple.com/account/)
2. Menu : **Certificates, Identifiers & Profiles**
3. Cliquez sur **Identifiers** → Bouton **+** (Ajouter)
4. Sélectionnez **App IDs** → **Continue**
5. Choisissez **App** → **Continue**
6. Remplissez :
   - **Description** : Lini App
   - **Bundle ID** : `com.votrenom.lini` (choisissez un identifiant unique)
7. Dans **Capabilities**, activez **Sign in with Apple**
8. Cliquez sur **Continue** → **Register**

### 2.2 Créer un Service ID

1. Retournez dans **Identifiers** → Bouton **+**
2. Sélectionnez **Services IDs** → **Continue**
3. Remplissez :
   - **Description** : Lini Web Service
   - **Identifier** : `com.votrenom.lini.service` (différent de l'App ID)
4. **Continue** → **Register**

### 2.3 Configurer le Service ID

1. Cliquez sur le Service ID que vous venez de créer
2. Activez **Sign in with Apple**
3. Cliquez sur **Configure** à côté de "Sign in with Apple"
4. Dans **Primary App ID** : sélectionnez votre App ID (Lini App)
5. Dans **Domains and Subdomains**, ajoutez :
   ```
   lini-47633.firebaseapp.com
   ```
6. Dans **Return URLs**, ajoutez :
   ```
   https://lini-47633.firebaseapp.com/__/auth/handler
   ```
   ⚠️ Remplacez `lini-47633` par votre propre ID de projet Firebase si différent
7. Cliquez sur **Next** → **Done** → **Continue** → **Save**

### 2.4 Créer une clé (Key)

1. Dans le menu, cliquez sur **Keys** → Bouton **+**
2. Nom : **Lini Sign in with Apple Key**
3. Activez **Sign in with Apple**
4. Cliquez sur **Configure** à côté
5. Sélectionnez votre **Primary App ID** (Lini App)
6. **Save** → **Continue** → **Register**
7. ⚠️ **IMPORTANT** : Téléchargez la clé (.p8 file)
   - Vous ne pourrez **PAS** la télécharger à nouveau !
8. Notez le **Key ID** (affiché sur la page)

## 🔙 Étape 3 : Finaliser dans Firebase

### 3.1 Obtenir votre Team ID

1. Retournez sur [Apple Developer Console](https://developer.apple.com/account/)
2. En haut à droite de la page, vous verrez votre **Team ID** (10 caractères)
3. Copiez-le

### 3.2 Configurer Firebase

1. Retournez dans **Firebase Console** → **Authentication** → **Apple**
2. Remplissez :
   - **OAuth code flow configuration** :
     - **Service ID** : `com.votrenom.lini.service` (votre Service ID)
     - **Apple Team ID** : Votre Team ID (10 caractères)
     - **Key ID** : Le Key ID de l'étape 2.4
     - **Private Key** : Ouvrez le fichier .p8 téléchargé et copiez tout le contenu
3. Cliquez sur **Save**

✅ Firebase est maintenant configuré !

## 📱 Étape 4 : Configuration dans app.json (Expo)

### 4.1 Mettre à jour app.json

Ajoutez ces configurations dans votre `app.json` :

```json
{
  "expo": {
    "name": "Lini",
    "slug": "lini",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.votrenom.lini",
      "usesAppleSignIn": true
    },
    "android": {
      "package": "com.votrenom.lini"
    }
  }
}
```

⚠️ Remplacez `com.votrenom.lini` par le Bundle ID que vous avez choisi à l'étape 2.1

## ✅ Étape 5 : Tester

### 5.1 Sur iOS (obligatoire pour Apple Sign-in)

1. **Build et installation** :
   ```bash
   npx expo prebuild
   npx expo run:ios
   ```

2. ⚠️ Sign in with Apple ne fonctionne **QUE sur un appareil iOS réel** ou dans un simulateur iOS configuré

3. Testez la connexion :
   - Ouvrez l'app
   - Cliquez sur "Continuer avec Apple"
   - Connectez-vous avec votre Apple ID
   - ✅ Vous devriez être connecté !

### 5.2 Vérification dans Firebase

1. Allez dans **Firebase Console** → **Authentication** → **Users**
2. Vous devriez voir votre compte avec le provider "apple.com"
3. Allez dans **Firestore Database** → **users**
4. Vous devriez voir votre document utilisateur

## 🎯 Résumé des identifiants

Gardez ces informations en sécurité :

```
App ID (Bundle Identifier) : com.votrenom.lini
Service ID                 : com.votrenom.lini.service
Team ID                    : XXXXXXXXXX (10 caractères)
Key ID                     : YYYYYYYYYY (10 caractères)
Private Key                : Fichier .p8
```

## 🐛 Dépannage

### "Sign in with Apple button not visible"
→ Le bouton apparaît uniquement sur iOS
→ Vérifiez que vous testez sur un appareil iOS ou simulateur iOS

### "Invalid client"
→ Vérifiez que le Service ID correspond dans Firebase et Apple Developer
→ Vérifiez que le Team ID est correct

### "Invalid grant"
→ Vérifiez que la Private Key est correctement copiée
→ Vérifiez que le Key ID correspond

### "Redirect URI mismatch"
→ Vérifiez que l'URL de retour dans Apple Developer correspond exactement :
  `https://lini-47633.firebaseapp.com/__/auth/handler`

## 📚 Ressources

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Firebase Apple Auth Documentation](https://firebase.google.com/docs/auth/ios/apple)
- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)

## ⏭️ Prochaines étapes

Une fois Sign in with Apple configuré, vous pourriez aussi ajouter :
- **Sign in with Google** (plus facile à configurer)
- **Sign in with Facebook**
- **Sign in with GitHub**

## 💡 Notes importantes

1. **Apple App Store Requirement** :
   - Si vous proposez d'autres méthodes de connexion sociale (Google, Facebook), vous **DEVEZ** aussi proposer Sign in with Apple
   - C'est une règle de l'App Store

2. **Environnement de test** :
   - Utilisez un Apple ID de test pour ne pas polluer votre compte principal

3. **Production** :
   - Avant de publier, assurez-vous que tous les identifiants sont corrects
   - Testez sur plusieurs appareils iOS réels

4. **Email masqué** :
   - Apple peut masquer l'email de l'utilisateur avec `privaterelay@icloud.com`
   - Votre app doit gérer ce cas

---

Félicitations ! 🎉 Votre app supporte maintenant Sign in with Apple ET Email/Password !

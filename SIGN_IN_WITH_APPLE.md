# Sign in with Apple - Guide rapide

## ✅ Qu'est-ce qui a été implémenté ?

Votre application **Lini** supporte maintenant 2 méthodes de connexion :

1. **Email/Password** (déjà fonctionnel ✅)
2. **Sign in with Apple** (nécessite configuration)

## 📱 Où se trouve le bouton Apple ?

Le bouton "Continuer avec Apple" apparaît :
- Sur la page de **Connexion** (LoginScreen)
- Sur la page d'**Inscription** (OnboardingScreen)

⚠️ Le bouton est visible **uniquement sur iOS** (iPhone, iPad)

## 🚀 Comment ça fonctionne ?

### Pour l'utilisateur :

1. L'utilisateur clique sur "Continuer avec Apple"
2. iOS affiche la popup de connexion Apple
3. L'utilisateur s'authentifie avec Face ID / Touch ID / mot de passe
4. L'utilisateur peut choisir de masquer son email
5. Il est automatiquement connecté à l'app

### En coulisses :

1. L'app obtient un token d'Apple
2. Le token est envoyé à Firebase
3. Firebase crée/connecte l'utilisateur
4. Les données sont sauvegardées dans Firestore
5. L'utilisateur accède à l'app

## 🔧 Configuration requise

### Ce qui est DÉJÀ fait dans le code ✅ :

- ✅ expo-apple-authentication installé
- ✅ Fonction `signInWithApple()` créée
- ✅ Boutons Apple ajoutés sur les pages
- ✅ Gestion automatique des utilisateurs
- ✅ Sauvegarde dans Firestore

### Ce que VOUS devez faire :

1. **Avoir un Apple Developer Account** (99$/an)
   - Sans cela, Sign in with Apple ne fonctionnera pas
   - Vous pouvez continuer avec Email/Password en attendant

2. **Configurer Firebase Authentication**
   - Activer Apple comme provider
   - Voir le guide : `APPLE_SIGNIN_SETUP.md`

3. **Configurer Apple Developer Console**
   - Créer App ID, Service ID, Key
   - Voir le guide : `APPLE_SIGNIN_SETUP.md`

4. **Tester sur un appareil iOS réel**
   - Sign in with Apple ne fonctionne pas dans un navigateur web
   - Il faut un iPhone/iPad ou simulateur iOS

## 📖 Guide complet

Consultez **`APPLE_SIGNIN_SETUP.md`** pour :
- Instructions pas à pas
- Configuration Firebase
- Configuration Apple Developer
- Dépannage des erreurs

## ⚡ Démarrage rapide

Si vous avez déjà un Apple Developer Account :

### Étape 1 : Firebase
1. Firebase Console → Authentication → Sign-in method
2. Activer **Apple**
3. Suivre les instructions de Firebase

### Étape 2 : Apple Developer
1. developer.apple.com → Certificates, Identifiers & Profiles
2. Créer App ID avec "Sign in with Apple"
3. Créer Service ID
4. Créer Key (.p8)

### Étape 3 : Tester
```bash
npx expo prebuild
npx expo run:ios
```

## 🎯 État actuel de l'app

| Fonctionnalité | Statut | Testé |
|---|---|---|
| Inscription Email/Password | ✅ Fonctionne | ✅ Oui |
| Connexion Email/Password | ✅ Fonctionne | ✅ Oui |
| Déconnexion | ✅ Fonctionne | ⚠️ À tester |
| Sign in with Apple (code) | ✅ Implémenté | ⚠️ Nécessite config |
| Bouton Apple visible | ✅ Sur iOS seulement | ⚠️ À tester |
| Sauvegarde Firestore | ✅ Fonctionne | ✅ Oui |
| Upload photo profil | ⚠️ Nécessite Storage | ⚠️ Optionnel |

## ❓ FAQ

### Le bouton Apple n'apparaît pas
→ Normal sur web/Android. Il n'apparaît que sur iOS.

### Je n'ai pas de compte Apple Developer
→ Pas de problème ! Utilisez Email/Password. Vous pourrez ajouter Apple plus tard.

### C'est obligatoire ?
→ Non, Email/Password fonctionne parfaitement.
→ Oui SI vous ajoutez Google/Facebook et que vous publiez sur l'App Store.

### Ça coûte de l'argent ?
→ Oui, le compte Apple Developer coûte 99$/an.

### Combien de temps pour configurer ?
→ Environ 30 minutes si vous avez un Apple Developer Account.

## 🔐 Sécurité

Sign in with Apple est :
- ✅ Très sécurisé (géré par Apple)
- ✅ Rapide pour l'utilisateur
- ✅ Respectueux de la vie privée (email masqué possible)
- ✅ Recommandé par Apple

## 📊 Données stockées

Lors d'une connexion Apple, on sauvegarde :
```javascript
{
  uid: "...",
  email: "utilisateur@email.com" ou "privaterelay@icloud.com",
  firstName: "Prénom" (si fourni),
  lastName: "Nom" (si fourni),
  photoURL: null,
  authProvider: "apple",
  createdAt: "2025-01-07T...",
  updatedAt: "2025-01-07T..."
}
```

## ✨ Avantages pour vos utilisateurs

- Connexion en 1 clic
- Pas de mot de passe à retenir
- Très rapide
- Sécurisé avec Face ID/Touch ID
- Protection de la vie privée

---

**Prêt à configurer ?** → Consultez `APPLE_SIGNIN_SETUP.md`

**Besoin d'aide ?** → Vérifiez la section Dépannage du guide complet

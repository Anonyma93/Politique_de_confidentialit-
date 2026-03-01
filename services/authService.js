import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  OAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, getCountFromServer } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import { parseFirebaseError } from '../utils/firebaseErrors';
import * as AppleAuthentication from 'expo-apple-authentication';
import { sha256 } from 'js-sha256';

/**
 * Créer un nouveau compte utilisateur
 */
export const signUp = async (userData) => {
  let user = null;

  try {
    const { email, password, firstName, lastName, photoUri, preferredLines, preferredStations, city } = userData;

    // 1. Créer l'utilisateur dans Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    user = userCredential.user;

    // 2. Uploader la photo de profil si fournie (optionnel)
    let photoURL = null;
    if (photoUri) {
      try {
        photoURL = await uploadProfilePhoto(user.uid, photoUri);
      } catch (uploadError) {
        console.warn('Erreur lors de l\'upload de la photo (continuons sans photo):', uploadError);
        // On continue sans photo si l'upload échoue
      }
    }

    // 3. Mettre à jour le profil Firebase Auth
    await updateProfile(user, {
      displayName: `${firstName} ${lastName}`,
      photoURL: photoURL,
    });

    // 4. Sauvegarder les informations supplémentaires dans Firestore
    // Avec timeout pour éviter le blocage
    try {
      const firestorePromise = setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: email,
        displayName: `${firstName} ${lastName}`, // Requis par les règles Firestore
        firstName: firstName,
        lastName: lastName,
        photoURL: photoURL,
        preferredLines: preferredLines || [],
        preferredStations: preferredStations || [],
        cities: [city || 'Paris'], // Tableau de villes
        city: city || 'Paris', // Pour rétro-compatibilité
        grade: 'Touriste', // Grade par défaut pour les nouveaux utilisateurs
        postsCount: 0, // Nombre de posts créés
        likesCount: 0, // Nombre de likes reçus
        userScore: 0, // Score de notation caché (calculé automatiquement)
        engagementRate: 0, // Taux d'engagement (likes par post)
        walkthroughCompleted: false, // Walkthrough pas encore terminé
        firstLoginDate: new Date().toISOString(), // Pour l'essai gratuit de 14 jours
        isPremium: false, // Statut premium (abonnement payant)
        premiumExpiresAt: null, // Date d'expiration de l'abonnement
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore timeout')), 10000)
      );

      await Promise.race([firestorePromise, timeoutPromise]);

      console.log('✅ Utilisateur sauvegardé dans Firestore');
    } catch (firestoreError) {
      console.error('⚠️ Erreur Firestore (continuons quand même):', firestoreError);
      // On continue sans Firestore - l'utilisateur est quand même créé dans Auth
      // Il pourra se connecter et on créera le document Firestore plus tard
    }

    return { success: true, user, firestoreSkipped: true };
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);

    // Si l'utilisateur a été créé mais qu'il y a eu une erreur après, on le supprime
    if (user) {
      try {
        await user.delete();
      } catch (deleteError) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', deleteError);
      }
    }

    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Connexion avec email et mot de passe
 */
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Connexion avec Apple
 */
export const signInWithApple = async () => {
  try {
    // Générer un nonce aléatoire pour la sécurité
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const hashedNonce = sha256(nonce);

    // Demander les credentials Apple
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    // Créer le credential Firebase
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleCredential.identityToken,
      rawNonce: nonce,
    });

    // Se connecter avec Firebase
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // Vérifier si c'est un nouvel utilisateur
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Nouveau compte - créer le document Firestore
      const firstName = appleCredential.fullName?.givenName || 'Utilisateur';
      const lastName = appleCredential.fullName?.familyName || 'Apple';
      const email = appleCredential.email || user.email || `${user.uid}@privaterelay.appleid.com`;

      // Mettre à jour le profil Firebase Auth
      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`,
      });

      // Créer le document Firestore
      await setDoc(userDocRef, {
        uid: user.uid,
        email: email,
        displayName: `${firstName} ${lastName}`, // Requis par les règles Firestore
        firstName: firstName,
        lastName: lastName,
        photoURL: null,
        preferredLines: [],
        preferredStations: [],
        cities: ['Paris'],
        city: 'Paris',
        grade: 'Touriste',
        postsCount: 0,
        likesCount: 0,
        userScore: 0,
        engagementRate: 0,
        walkthroughCompleted: false,
        firstLoginDate: new Date().toISOString(),
        isPremium: false,
        premiumExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authProvider: 'apple',
      });

      return { success: true, user, isNewUser: true };
    }

    // Utilisateur existant
    return { success: true, user, isNewUser: false };
  } catch (error) {
    console.error('Erreur lors de la connexion avec Apple:', error);

    if (error.code === 'ERR_CANCELED') {
      return { success: false, error: 'Connexion annulée', canceled: true };
    }

    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Déconnexion
 */
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Changer le mot de passe
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;

    if (!user || !user.email) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    // Ré-authentifier l'utilisateur (requis pour les opérations sensibles)
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Changer le mot de passe
    await updatePassword(user, newPassword);

    return { success: true };
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);

    if (error.code === 'auth/wrong-password') {
      return { success: false, error: 'Le mot de passe actuel est incorrect' };
    }

    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Supprimer le compte utilisateur
 * @param {string|null} password - Le mot de passe (null pour les utilisateurs Apple)
 * @param {boolean} isAppleUser - True si l'utilisateur s'est connecté via Apple
 */
export const deleteAccount = async (password, isAppleUser = false) => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    // Ré-authentifier l'utilisateur (requis pour supprimer le compte)
    if (isAppleUser) {
      // Ré-authentification via Apple Sign-In
      try {
        const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hashedNonce = sha256(nonce);

        const appleCredential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });

        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: appleCredential.identityToken,
          rawNonce: nonce,
        });

        await reauthenticateWithCredential(user, credential);
      } catch (appleError) {
        if (appleError.code === 'ERR_CANCELED') {
          return { success: false, error: 'Authentification annulée', canceled: true };
        }
        throw appleError;
      }
    } else if (user.email && password) {
      // Ré-authentification via mot de passe
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    }

    const userId = user.uid;

    // Supprimer le document Firestore
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (firestoreError) {
      console.warn('Erreur lors de la suppression du document Firestore:', firestoreError);
      // On continue même si Firestore échoue
    }

    // Supprimer l'utilisateur de Authentication
    await deleteUser(user);

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error);

    if (error.code === 'auth/wrong-password') {
      return { success: false, error: 'Le mot de passe est incorrect' };
    }

    if (error.code === 'auth/requires-recent-login') {
      return { success: false, error: 'Veuillez vous reconnecter avant de supprimer votre compte' };
    }

    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Obtenir l'utilisateur actuellement connecté
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Upload photo de profil
 */
export const uploadProfilePhoto = async (userId, photoUri) => {
  try {
    // Convertir l'URI en blob
    const response = await fetch(photoUri);
    const blob = await response.blob();

    // Créer une référence dans Storage
    const storageRef = ref(storage, `profile-photos/${userId}.jpg`);

    // Upload
    await uploadBytes(storageRef, blob);

    // Récupérer l'URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Erreur lors de l\'upload de la photo:', error);
    throw error;
  }
};

/**
 * Récupérer les données utilisateur depuis Firestore
 */
export const getUserData = async (userId) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Utilisateur non trouvé' };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Mettre à jour le profil utilisateur
 */
export const updateUserProfile = async (updates) => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    const userRef = doc(db, 'users', user.uid);

    // Vérifier si le document existe
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Le document n'existe pas - le créer avec les champs requis
      const displayName = user.displayName || `${updates.firstName || 'Utilisateur'} ${updates.lastName || ''}`.trim();
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: displayName,
        firstName: updates.firstName || user.displayName?.split(' ')[0] || 'Utilisateur',
        lastName: updates.lastName || user.displayName?.split(' ').slice(1).join(' ') || '',
        photoURL: user.photoURL || null,
        preferredLines: [],
        preferredStations: [],
        cities: ['Paris'],
        city: 'Paris',
        grade: 'Touriste',
        postsCount: 0,
        likesCount: 0,
        userScore: 0,
        engagementRate: 0,
        walkthroughCompleted: false,
        firstLoginDate: new Date().toISOString(),
        isPremium: false,
        premiumExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      });
    } else {
      // Le document existe - mise à jour normale
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Mettre à jour aussi displayName si firstName ou lastName changent
      if (updates.firstName || updates.lastName) {
        const currentData = userDoc.data();
        const firstName = updates.firstName || currentData.firstName || '';
        const lastName = updates.lastName || currentData.lastName || '';
        updateData.displayName = `${firstName} ${lastName}`.trim();
      }

      await setDoc(userRef, updateData, { merge: true });
    }

    // Mettre à jour le displayName dans Firebase Auth si firstName ou lastName changent
    if (updates.firstName || updates.lastName) {
      const userData = await getUserData(user.uid);
      if (userData.success) {
        const firstName = updates.firstName || userData.data.firstName || '';
        const lastName = updates.lastName || userData.data.lastName || '';
        await updateProfile(user, {
          displayName: `${firstName} ${lastName}`.trim(),
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Mettre à jour la photo de profil
 */
export const updateProfilePhoto = async (photoUri) => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    // Upload la nouvelle photo
    const photoURL = await uploadProfilePhoto(user.uid, photoUri);

    // Mettre à jour Firestore
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      photoURL: photoURL,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Mettre à jour Firebase Auth
    await updateProfile(user, {
      photoURL: photoURL,
    });

    return { success: true, photoURL };
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la photo:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Mettre à jour les lignes préférées
 */
export const updatePreferredLines = async (preferredLines) => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      preferredLines: preferredLines,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour des lignes préférées:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Mettre à jour les stations préférées
 */
export const updatePreferredStations = async (preferredStations) => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      preferredStations: preferredStations,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour des stations préférées:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Mettre à jour le grade de l'utilisateur
 */
export const updateUserGrade = async (grade) => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      grade: grade,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du grade:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Incrémenter le nombre de posts de l'utilisateur
 */
export const incrementPostsCount = async () => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const currentCount = userDoc.data().postsCount || 0;
      await setDoc(userRef, {
        postsCount: currentCount + 1,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Mise à jour du streak avant le score (le score lit le streak depuis Firestore)
      await updateStreak(user.uid);
      await updateUserScore(user.uid);

      return { success: true, newCount: currentCount + 1 };
    }

    return { success: false, error: 'Utilisateur non trouvé' };
  } catch (error) {
    console.error('Erreur lors de l\'incrémentation des posts:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Incrémenter le nombre de likes de l'utilisateur
 */
export const incrementLikesCount = async (userId = null) => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;

    if (!targetUserId) {
      return { success: false, error: 'Utilisateur non spécifié' };
    }

    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const currentCount = userDoc.data().likesCount || 0;
      await setDoc(userRef, {
        likesCount: currentCount + 1,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Mettre à jour automatiquement le score
      await updateUserScore(targetUserId);

      return { success: true, newCount: currentCount + 1 };
    }

    return { success: false, error: 'Utilisateur non trouvé' };
  } catch (error) {
    console.error('Erreur lors de l\'incrémentation des likes:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Incrémenter le nombre de likes donnés par l'utilisateur
 */
export const incrementLikesGiven = async (userId = null) => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;

    if (!targetUserId) {
      return { success: false, error: 'Utilisateur non spécifié' };
    }

    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const currentCount = userDoc.data().likesGiven || 0;
      await setDoc(userRef, {
        likesGiven: currentCount + 1,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Mise à jour du streak avant le score (le score lit le streak depuis Firestore)
      await updateStreak(targetUserId);
      await updateUserScore(targetUserId);

      return { success: true, newCount: currentCount + 1 };
    }

    return { success: false, error: 'Utilisateur non trouvé' };
  } catch (error) {
    console.error('Erreur lors de l\'incrémentation des likes donnés:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Décrémenter le nombre de likes donnés par l'utilisateur (pour unlike)
 */
export const decrementLikesGiven = async (userId = null) => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;

    if (!targetUserId) {
      return { success: false, error: 'Utilisateur non spécifié' };
    }

    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const currentCount = userDoc.data().likesGiven || 0;
      await setDoc(userRef, {
        likesGiven: Math.max(0, currentCount - 1),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Mettre à jour automatiquement le score
      await updateUserScore(targetUserId);

      return { success: true, newCount: Math.max(0, currentCount - 1) };
    }

    return { success: false, error: 'Utilisateur non trouvé' };
  } catch (error) {
    console.error('Erreur lors de la décrémentation des likes donnés:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Décrémenter le nombre de likes de l'utilisateur (pour unlike)
 */
export const decrementLikesCount = async (userId = null) => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;

    if (!targetUserId) {
      return { success: false, error: 'Utilisateur non spécifié' };
    }

    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const currentCount = userDoc.data().likesCount || 0;
      await setDoc(userRef, {
        likesCount: Math.max(0, currentCount - 1), // Ne pas descendre en dessous de 0
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Mettre à jour automatiquement le score
      await updateUserScore(targetUserId);

      return { success: true, newCount: Math.max(0, currentCount - 1) };
    }

    return { success: false, error: 'Utilisateur non trouvé' };
  } catch (error) {
    console.error('Erreur lors de la décrémentation des likes:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Mettre à jour le streak de l'utilisateur
 *
 * Un streak progresse si l'utilisateur est actif (post ou like) chaque jour.
 * Un jour sans activité remet le streak à 1 dès la prochaine action.
 *
 * Champs Firestore : lastActivityDate (YYYY-MM-DD), currentStreak, maxStreak
 */
export const updateStreak = async (userId = null) => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) return;

    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" UTC
    const lastActivityDate = userData.lastActivityDate || null;

    // Déjà actif aujourd'hui → pas de changement
    if (lastActivityDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const currentStreak = userData.currentStreak || 0;
    const newStreak = lastActivityDate === yesterday ? currentStreak + 1 : 1;
    const newMaxStreak = Math.max(newStreak, userData.maxStreak || 0);

    await setDoc(userRef, {
      lastActivityDate: today,
      currentStreak: newStreak,
      maxStreak: newMaxStreak,
    }, { merge: true });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du streak:', error);
  }
};

/**
 * Obtenir le nombre total d'utilisateurs
 */
export const getTotalUsersCount = async () => {
  try {
    const usersCollection = collection(db, 'users');
    const snapshot = await getCountFromServer(usersCollection);
    return { success: true, count: snapshot.data().count };
  } catch (error) {
    console.error('Erreur lors du comptage des utilisateurs:', error);
    return { success: false, error: parseFirebaseError(error), count: 1 };
  }
};

/**
 * Calculer le score d'un utilisateur
 *
 * 5 composantes indépendantes :
 *
 * 1. engagementRate  : qualité (likes/post, plafonné à 10)
 * 2. activityBonus   : fréquence de publication (log)
 * 3. volumeBonus     : contribution brute totale (total likes reçus, log)
 *                      → différencie 50posts/50likes de 10posts/10likes
 * 4. involvementBonus: implication communautaire (likes donnés, plafonné)
 * 5. seniorityBonus  : ancienneté du compte (log)
 * 6. streakBonus     : régularité (paliers : 3j, 7j, 14j, 30j)
 *
 * Formule : (engagementRate × (1 + activityBonus) + volumeBonus
 *            + involvementBonus + seniorityBonus + streakBonus + baseBonus) / 3.0
 *
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {Object} - { success, score, engagementRate }
 */
export const calculateUserScore = async (userId = null) => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;

    if (!targetUserId) {
      return { success: false, error: 'Utilisateur non spécifié' };
    }

    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    const userData = userDoc.data();
    const postsCount = userData.postsCount || 0;
    const likesCount = userData.likesCount || 0;
    const likesGiven = userData.likesGiven || 0;
    const currentStreak = userData.currentStreak || 0;
    const createdAt = userData.createdAt || null;

    // 1. Qualité : ratio likes/post plafonné à 10 (évite l'explosion avec peu de posts)
    const engagementRate = postsCount > 0 ? Math.min(likesCount / postsCount, 10) : 0;

    // 2. Activité : fréquence de publication (logarithmique)
    const activityBonus = Math.log(postsCount + 1) * 0.35;

    // 3. Volume : contribution brute — ce qui différencie 50/50 de 10/10 avec le même ratio
    const volumeBonus = Math.log(likesCount + 1) * 0.3;

    // 4. Implication communautaire : plafonné à postsCount × 10 pour éviter le like-farming
    const likesGivenCapped = Math.min(likesGiven, (postsCount + 1) * 10);
    const involvementBonus = Math.log(likesGivenCapped + 1) * 0.2;

    // 5. Ancienneté : récompense la fidélité sur la durée
    const daysOnPlatform = createdAt
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
      : 0;
    const seniorityBonus = Math.log(daysOnPlatform + 1) * 0.15;

    // 6. Streak : bonus de régularité (post ou like chaque jour)
    //    3 jours → +0.1 | 7 jours → +0.3 | 14 jours → +0.6 | 30 jours → +1.0
    let streakBonus = 0;
    if (currentStreak >= 30) streakBonus = 1.0;
    else if (currentStreak >= 14) streakBonus = 0.6;
    else if (currentStreak >= 7) streakBonus = 0.3;
    else if (currentStreak >= 3) streakBonus = 0.1;

    // Bonus de base pour les utilisateurs actifs
    const baseBonus = postsCount > 0 ? 0.25 : 0;

    // Score final : normalisation fixe (indépendante du nombre d'utilisateurs)
    const baseScore = engagementRate * (1 + activityBonus)
      + volumeBonus
      + involvementBonus
      + seniorityBonus
      + streakBonus
      + baseBonus;

    const NORMALIZATION = 3.0;
    const userScore = Math.round((baseScore / NORMALIZATION) * 100) / 100;
    const roundedEngagementRate = Math.round(engagementRate * 100) / 100;

    return {
      success: true,
      score: userScore,
      engagementRate: roundedEngagementRate,
      metrics: {
        postsCount,
        likesCount,
        likesGiven,
        currentStreak,
        daysOnPlatform,
        activityBonus: Math.round(activityBonus * 100) / 100,
        volumeBonus: Math.round(volumeBonus * 100) / 100,
        involvementBonus: Math.round(involvementBonus * 100) / 100,
        seniorityBonus: Math.round(seniorityBonus * 100) / 100,
        streakBonus,
      }
    };
  } catch (error) {
    console.error('Erreur lors du calcul du score:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Déterminer le grade en fonction du score
 *
 * Ordre des grades (du pire au meilleur) - Seuils ajustés pour une progression plus progressive :
 * 1. Touriste (0.00 - 0.29)
 * 2. Agent de Bord (0.30 - 0.54)
 * 3. Chef de Quai (0.55 - 0.79)
 * 4. Contrôleur (0.80 - 1.09)
 * 5. Inspecteur Réseau (1.10 - 1.39)
 * 6. Pro du Strapontin (1.40 - 1.79)
 * 7. Dompteur de Navigo (1.80 - 2.29)
 * 8. Sauveur de ligne (2.30 - 2.79)
 * 9. Ministre du transport (2.80 - 3.49)
 * 10. Légende Métropolitaine (3.50 - 4.49)
 * 11. Guide suprême (4.50+)
 *
 * @param {number} score - Le score de l'utilisateur
 * @returns {string} - Le grade correspondant
 */
export const getGradeFromScore = (score) => {
  if (score >= 4.50) return 'Guide suprême';
  if (score >= 3.50) return 'Légende Métropolitaine';
  if (score >= 2.80) return 'Ministre du transport';
  if (score >= 2.30) return 'Sauveur de ligne';
  if (score >= 1.80) return 'Dompteur de Navigo';
  if (score >= 1.40) return 'Pro du Strapontin';
  if (score >= 1.10) return 'Inspecteur Réseau';
  if (score >= 0.80) return 'Contrôleur';
  if (score >= 0.55) return 'Chef de Quai';
  if (score >= 0.30) return 'Agent de Bord';
  return 'Touriste';
};

/**
 * Mettre à jour le score d'un utilisateur dans Firestore
 *
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {Object} - { success, score, grade }
 */
export const updateUserScore = async (userId = null) => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;

    if (!targetUserId) {
      return { success: false, error: 'Utilisateur non spécifié' };
    }

    // Calculer le nouveau score
    const scoreResult = await calculateUserScore(targetUserId);

    if (!scoreResult.success) {
      return scoreResult;
    }

    // Déterminer le grade en fonction du score
    const newGrade = getGradeFromScore(scoreResult.score);

    // Sauvegarder dans Firestore
    const userRef = doc(db, 'users', targetUserId);
    await setDoc(userRef, {
      userScore: scoreResult.score,
      engagementRate: scoreResult.engagementRate,
      grade: newGrade, // Mise à jour automatique du grade
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return {
      success: true,
      score: scoreResult.score,
      engagementRate: scoreResult.engagementRate,
      grade: newGrade,
    };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du score:', error);
    return { success: false, error: parseFirebaseError(error) };
  }
};

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  OAuthProvider,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, getCountFromServer } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import { parseFirebaseError } from '../utils/firebaseErrors';
import * as AppleAuthentication from 'expo-apple-authentication';

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
        walkthroughSteps: [], // Aucune étape complétée
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
 */
export const deleteAccount = async (password) => {
  try {
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    // Ré-authentifier l'utilisateur (requis pour supprimer le compte)
    if (user.email && password) {
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
 * Connexion avec Apple
 */
export const signInWithApple = async () => {
  try {
    // 1. Demander l'authentification Apple
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // 2. Créer un credential Firebase avec le token Apple
    const { identityToken } = appleCredential;
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: identityToken,
    });

    // 3. Se connecter à Firebase avec le credential Apple
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // 4. Vérifier si c'est un nouvel utilisateur
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const isNewUser = !userDoc.exists();

    if (isNewUser) {
      // Nouvel utilisateur - créer le profil dans Firestore avec infos minimales
      const firstName = appleCredential.fullName?.givenName || '';
      const lastName = appleCredential.fullName?.familyName || '';
      const email = user.email || appleCredential.email || '';

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        photoURL: user.photoURL || null,
        preferredLines: [],
        preferredStations: [],
        cities: ['Paris'], // Tableau de villes
        city: 'Paris', // Pour rétro-compatibilité
        grade: 'Touriste', // Grade par défaut pour les nouveaux utilisateurs
        postsCount: 0, // Nombre de posts créés
        likesCount: 0, // Nombre de likes reçus
        userScore: 0, // Score de notation caché (calculé automatiquement)
        engagementRate: 0, // Taux d'engagement (likes par post)
        firstLoginDate: new Date().toISOString(), // Pour l'essai gratuit de 14 jours
        isPremium: false, // Statut premium (abonnement payant)
        premiumExpiresAt: null, // Date d'expiration de l'abonnement
        authProvider: 'apple',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mettre à jour le displayName si on a le nom
      if (firstName || lastName) {
        await updateProfile(user, {
          displayName: `${firstName} ${lastName}`.trim(),
        });
      }

      // Retourner les données pour l'onboarding
      return {
        success: true,
        user,
        isNewUser: true,
        profileIncomplete: true,
        userData: {
          email,
          firstName,
          lastName,
          photoURL: user.photoURL || null,
        }
      };
    }

    // Utilisateur existant - vérifier si le profil est complet
    const userData = userDoc.data();
    const profileIncomplete = !userData.preferredLines?.length && !userData.preferredStations?.length;

    return {
      success: true,
      user,
      isNewUser: false,
      profileIncomplete,
      userData: profileIncomplete ? {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        photoURL: userData.photoURL,
      } : null
    };
  } catch (error) {
    console.error('Erreur lors de la connexion Apple:', error);

    // Gérer l'annulation par l'utilisateur
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: 'Connexion annulée', canceled: true };
    }

    // Gérer le cas où Apple n'est pas configuré dans Firebase
    if (error.code === 'auth/operation-not-allowed') {
      return {
        success: false,
        error: 'Sign in with Apple n\'est pas encore configuré. Utilisez Email/Password pour le moment.',
        notConfigured: true
      };
    }

    return { success: false, error: parseFirebaseError(error) };
  }
};

/**
 * Vérifier si Sign in with Apple est disponible
 */
export const isAppleAuthAvailable = async () => {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (error) {
    return false;
  }
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

    // Mettre à jour Firestore
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

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

      // Mettre à jour automatiquement le score
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

      // Mettre à jour automatiquement le score
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
 * Le score prend en compte :
 * - Engagement Rate : likesCount / postsCount (qualité)
 * - Activity Bonus : log(postsCount + 1) (activité)
 * - Normalisation : divisé par le nombre total d'utilisateurs
 *
 * Formule : (likesCount / postsCount) * (1 + log(postsCount + 1)) / sqrt(totalUsers)
 *
 * @param {string} userId - ID de l'utilisateur (optionnel, utilise l'utilisateur connecté par défaut)
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

    // Calculer l'engagement rate (likes moyens par post)
    const engagementRate = postsCount > 0 ? likesCount / postsCount : 0;

    // Calculer le bonus d'activité (logarithmique pour éviter l'explosion)
    const activityBonus = Math.log(postsCount + 1);

    // Calculer le bonus d'implication (likes donnés)
    // Logarithmique aussi pour éviter l'abus, avec un poids plus faible que les posts
    const involvementBonus = Math.log(likesGiven + 1) * 0.3;

    // Obtenir le nombre total d'utilisateurs pour la normalisation
    const totalUsersResult = await getTotalUsersCount();
    const totalUsers = totalUsersResult.count || 1;

    // Score de base : engagement × (1 + activité + implication)
    const baseScore = engagementRate * (1 + activityBonus + involvementBonus);

    // Normalisation par la racine carrée du nombre d'utilisateurs
    // (plus il y a d'utilisateurs, plus il est difficile d'avoir un score élevé)
    const normalizedScore = baseScore / Math.sqrt(totalUsers);

    // Arrondir à 2 décimales
    const userScore = Math.round(normalizedScore * 100) / 100;
    const roundedEngagementRate = Math.round(engagementRate * 100) / 100;

    return {
      success: true,
      score: userScore,
      engagementRate: roundedEngagementRate,
      metrics: {
        postsCount,
        likesCount,
        likesGiven,
        activityBonus: Math.round(activityBonus * 100) / 100,
        involvementBonus: Math.round(involvementBonus * 100) / 100,
        totalUsers,
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
 * Ordre des grades (du pire au meilleur) :
 * 1. Touriste (0.00 - 0.30)
 * 2. Agent de Bord (0.31 - 0.60)
 * 3. Chef de Quai (0.61 - 0.90)
 * 4. Contrôleur (0.91 - 1.20)
 * 5. Inspecteur Réseau (1.21 - 1.50)
 * 6. Pro du Strapontin (1.51 - 1.80)
 * 7. Dompteur de Navigo (1.81 - 2.10)
 * 8. Sauveur de ligne (2.11 - 2.50)
 * 9. Ministre du transport (2.51 - 3.00)
 * 10. Légende Métropolitaine (3.01 - 4.00)
 * 11. Guide suprême (4.01+)
 *
 * @param {number} score - Le score de l'utilisateur
 * @returns {string} - Le grade correspondant
 */
export const getGradeFromScore = (score) => {
  if (score >= 4.01) return 'Guide suprême';
  if (score >= 3.01) return 'Légende Métropolitaine';
  if (score >= 2.51) return 'Ministre du transport';
  if (score >= 2.11) return 'Sauveur de ligne';
  if (score >= 1.81) return 'Dompteur de Navigo';
  if (score >= 1.51) return 'Pro du Strapontin';
  if (score >= 1.21) return 'Inspecteur Réseau';
  if (score >= 0.91) return 'Contrôleur';
  if (score >= 0.61) return 'Chef de Quai';
  if (score >= 0.31) return 'Agent de Bord';
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

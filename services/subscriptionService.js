import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import conditionnel pour éviter l'erreur avec Expo Go
// DÉSACTIVÉ : Package retiré pour éviter les crashes
let InAppPurchases;
// if (!__DEV__) {
//   try {
//     InAppPurchases = require('expo-in-app-purchases');
//   } catch (error) {
//     console.warn('Expo In-App Purchases non disponible:', error);
//   }
// }

// ID de l'abonnement (à configurer dans App Store Connect)
const SUBSCRIPTION_SKU = 'lini_premium_monthly'; // 0,99€/mois

/**
 * Initialiser le service d'achats in-app
 */
export const initializeIAP = async () => {
  // Ne pas initialiser en mode développement (Expo Go)
  if (__DEV__ || !InAppPurchases) {
    console.log('Mode développement, IAP non initialisé');
    return { success: true };
  }

  try {
    await InAppPurchases.connectAsync();
    return { success: true };
  } catch (error) {
    console.error('Erreur initialisation IAP:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Déconnecter le service d'achats in-app
 */
export const disconnectIAP = async () => {
  if (__DEV__ || !InAppPurchases) {
    return;
  }

  try {
    await InAppPurchases.disconnectAsync();
  } catch (error) {
    console.error('Erreur déconnexion IAP:', error);
  }
};

/**
 * Vérifier si l'utilisateur est dans sa période d'essai gratuit (14 jours)
 */
export const isInFreeTrial = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();

    // Si l'utilisateur est déjà premium, pas besoin d'essai
    if (userData.isPremium) {
      return false;
    }

    // Vérifier la date de première connexion
    const firstLoginDate = userData.firstLoginDate || userData.createdAt;

    if (!firstLoginDate) {
      return true; // Par défaut, on considère que c'est un nouvel utilisateur
    }

    const firstLogin = new Date(firstLoginDate);
    const now = new Date();
    const daysSinceFirstLogin = Math.floor((now - firstLogin) / (1000 * 60 * 60 * 24));

    return daysSinceFirstLogin < 14;
  } catch (error) {
    console.error('Erreur vérification essai gratuit:', error);
    return false;
  }
};

/**
 * Vérifier si l'utilisateur est premium (abonné payant OU essai gratuit)
 */
export const isPremiumUser = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();

    // Si abonné payant
    if (userData.isPremium) {
      // Vérifier que l'abonnement n'a pas expiré
      if (userData.premiumExpiresAt) {
        const expirationDate = new Date(userData.premiumExpiresAt);
        const now = new Date();

        if (now < expirationDate) {
          return true;
        } else {
          // Abonnement expiré, mettre à jour
          await updateDoc(doc(db, 'users', userId), {
            isPremium: false,
            premiumExpiresAt: null,
          });
          return false;
        }
      }

      return true;
    }

    // Sinon, vérifier si dans l'essai gratuit
    return await isInFreeTrial(userId);
  } catch (error) {
    console.error('Erreur vérification premium:', error);
    return false;
  }
};

/**
 * Obtenir les produits disponibles (abonnements)
 */
export const getAvailableSubscriptions = async () => {
  if (__DEV__ || !InAppPurchases) {
    console.log('Mode développement, pas de produits IAP');
    return { success: true, products: [] };
  }

  try {
    const products = await InAppPurchases.getProductsAsync([SUBSCRIPTION_SKU]);
    return { success: true, products: products.results };
  } catch (error) {
    console.error('Erreur récupération produits:', error);
    return { success: false, error: error.message, products: [] };
  }
};

/**
 * Acheter l'abonnement premium
 */
export const purchaseSubscription = async (userId) => {
  if (__DEV__ || !InAppPurchases) {
    console.log('Mode développement, achat simulé');
    return { success: false, error: 'Fonctionnalité non disponible en développement', canceled: true };
  }

  try {
    // Acheter l'abonnement
    await InAppPurchases.purchaseItemAsync(SUBSCRIPTION_SKU);

    // Écouter les résultats de l'achat
    InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        // Achat réussi, mettre à jour Firestore
        results.forEach(async (purchase) => {
          if (purchase.productId === SUBSCRIPTION_SKU && purchase.acknowledged) {
            await activatePremium(userId, purchase);
          }
        });
      } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        console.log('Achat annulé par l\'utilisateur');
      } else {
        console.error('Erreur achat:', errorCode);
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur achat abonnement:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Activer le statut premium dans Firestore
 */
const activatePremium = async (userId, purchase) => {
  try {
    // Calculer la date d'expiration (30 jours pour un mois)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    await updateDoc(doc(db, 'users', userId), {
      isPremium: true,
      premiumExpiresAt: expirationDate.toISOString(),
      subscriptionId: purchase.transactionId,
      lastPurchaseDate: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur activation premium:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Restaurer les achats (pour changement d'appareil)
 */
export const restorePurchases = async (userId) => {
  if (__DEV__ || !InAppPurchases) {
    console.log('Mode développement, restauration simulée');
    return { success: true, restored: false };
  }

  try {
    const purchases = await InAppPurchases.getPurchaseHistoryAsync();

    if (purchases.results && purchases.results.length > 0) {
      // Trouver l'abonnement actif
      const activeSub = purchases.results.find(
        p => p.productId === SUBSCRIPTION_SKU && !p.acknowledged
      );

      if (activeSub) {
        await activatePremium(userId, activeSub);
        return { success: true, restored: true };
      }
    }

    return { success: true, restored: false };
  } catch (error) {
    console.error('Erreur restauration achats:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Enregistrer la première connexion de l'utilisateur (pour l'essai gratuit)
 */
export const registerFirstLogin = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (userDoc.exists() && !userDoc.data().firstLoginDate) {
      await updateDoc(doc(db, 'users', userId), {
        firstLoginDate: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur enregistrement première connexion:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtenir le statut complet de l'abonnement de l'utilisateur
 */
export const getSubscriptionStatus = async (userId) => {
  try {
    const isPremium = await isPremiumUser(userId);
    const isInTrial = await isInFreeTrial(userId);

    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : {};

    // Calculer les jours restants de l'essai
    let trialDaysRemaining = 0;
    if (isInTrial && !userData.isPremium) {
      const firstLoginDate = userData.firstLoginDate || userData.createdAt;
      if (firstLoginDate) {
        const firstLogin = new Date(firstLoginDate);
        const now = new Date();
        const daysSinceFirstLogin = Math.floor((now - firstLogin) / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, 14 - daysSinceFirstLogin);
      } else {
        trialDaysRemaining = 14;
      }
    }

    return {
      success: true,
      isPremium,
      isInTrial,
      isSubscribed: userData.isPremium || false,
      trialDaysRemaining,
      expiresAt: userData.premiumExpiresAt || null,
    };
  } catch (error) {
    console.error('Erreur récupération statut:', error);
    return {
      success: false,
      isPremium: false,
      isInTrial: false,
      isSubscribed: false,
      trialDaysRemaining: 0,
    };
  }
};

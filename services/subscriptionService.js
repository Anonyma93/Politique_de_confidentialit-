/**
 * Service d'abonnement avec RevenueCat
 * Gère les achats in-app et le statut premium
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Platform } from 'react-native';

// Import conditionnel de RevenueCat (ne fonctionne pas avec Expo Go)
let Purchases = null;
try {
  Purchases = require('react-native-purchases').default;
} catch (error) {
  console.log('⚠️ RevenueCat non disponible (Expo Go)');
}

// Configuration RevenueCat
const REVENUECAT_API_KEY_IOS = 'appl_WlbpXfZwhjOxiQaXTxccqqoiehe';
const REVENUECAT_API_KEY_ANDROID = 'goog_IGzZSALIJItcwqJOBGZltwSmHTg'; // goog_XXXXXXXXXXXX
const REVENUECAT_API_KEY = Platform.OS === 'android' ? REVENUECAT_API_KEY_ANDROID : REVENUECAT_API_KEY_IOS;
const ENTITLEMENT_ID = 'premium';

// Flags pour l'état de RevenueCat
// isExpoGo est true si le module Purchases n'est pas disponible (Expo Go)
const isExpoGo = !Purchases;
let isInitialized = false;

console.log('📱 RevenueCat module disponible:', !!Purchases, '| isExpoGo:', isExpoGo);

/**
 * S'assurer que RevenueCat est initialisé
 */
const ensureInitialized = async () => {
  if (isInitialized || isExpoGo || !Purchases) {
    return;
  }

  try {
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    isInitialized = true;
    console.log('✅ RevenueCat auto-initialisé');
  } catch (error) {
    console.error('❌ Erreur auto-init RevenueCat:', error);
  }
};

/**
 * Initialiser RevenueCat
 * @param {string} userId - ID de l'utilisateur Firebase
 */
export const initializeIAP = async (userId = null) => {
  if (!Purchases) {
    console.log('⚠️ RevenueCat non disponible (module non chargé)');
    return { success: true };
  }

  try {
    // Configurer RevenueCat si pas encore fait
    if (!isInitialized) {
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      isInitialized = true;
      console.log('✅ RevenueCat configuré');
    }

    // Si on a un userId, l'identifier auprès de RevenueCat
    if (userId) {
      console.log('🔐 Tentative de login RevenueCat pour:', userId);
      const { customerInfo } = await Purchases.logIn(userId);
      console.log('✅ RevenueCat initialisé pour:', userId);
      console.log('📊 CustomerInfo après login - App User ID:', customerInfo.originalAppUserId);
      console.log('📊 Entitlements actifs après login:', Object.keys(customerInfo.entitlements.active));
    } else {
      console.log('⚠️ RevenueCat initialisé (anonyme) - pas d\'userId fourni');
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Erreur initialisation RevenueCat:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Identifier l'utilisateur auprès de RevenueCat
 * @param {string} userId - ID de l'utilisateur Firebase
 */
export const identifyUser = async (userId) => {
  if (!Purchases || !userId) return { success: false };

  try {
    await Purchases.logIn(userId);
    console.log('✅ Utilisateur identifié:', userId);
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur identification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Déconnecter RevenueCat
 */
export const disconnectIAP = async () => {
  if (!Purchases) return;

  try {
    await Purchases.logOut();
    console.log('✅ RevenueCat déconnecté');
  } catch (error) {
    console.error('❌ Erreur déconnexion RevenueCat:', error);
  }
};

/**
 * Vérifier si l'utilisateur a l'entitlement premium via RevenueCat
 * @param {boolean} forceRefresh - Forcer le rafraîchissement du cache
 * @param {string} userId - ID de l'utilisateur Firebase (optionnel mais recommandé)
 */
export const checkRevenueCatPremium = async (forceRefresh = false, userId = null) => {
  console.log('🔍 checkRevenueCatPremium - Purchases:', !!Purchases, 'isExpoGo:', isExpoGo, 'userId:', userId);

  if (!Purchases || isExpoGo) {
    console.log('⚠️ RevenueCat non disponible, retourne false');
    return { isPremium: false, isActive: false, isExpoGo };
  }

  // S'assurer que RevenueCat est initialisé
  await ensureInitialized();

  try {
    // S'assurer que l'utilisateur est identifié si on a un userId
    if (userId) {
      try {
        const { customerInfo: loginInfo } = await Purchases.logIn(userId);
        console.log('✅ Utilisateur identifié pour vérification:', loginInfo.originalAppUserId);
      } catch (loginError) {
        // Si déjà connecté avec le bon ID, c'est OK
        console.log('ℹ️ Login info:', loginError.message);
      }
    }

    // Invalider le cache pour obtenir des données fraîches
    if (forceRefresh) {
      await Purchases.invalidateCustomerInfoCache();
    }

    const customerInfo = await Purchases.getCustomerInfo();
    console.log('📊 App User ID:', customerInfo.originalAppUserId);
    console.log('📊 CustomerInfo entitlements actifs:', Object.keys(customerInfo.entitlements.active));

    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement) {
      console.log('✅ Entitlement premium trouvé:', entitlement.productIdentifier);
      return {
        isPremium: true,
        isActive: true,
        expiresAt: entitlement.expirationDate,
        willRenew: entitlement.willRenew,
        productId: entitlement.productIdentifier,
      };
    }

    console.log('❌ Pas d\'entitlement premium actif');
    return { isPremium: false, isActive: false };
  } catch (error) {
    console.error('❌ Erreur vérification premium:', error);
    return { isPremium: false, isActive: false };
  }
};

/**
 * Vérifier si l'utilisateur est premium
 * Vérifie d'abord RevenueCat, puis synchronise avec Firestore
 * @param {string} userId - ID de l'utilisateur Firebase
 * @param {boolean} forceRefresh - Forcer le rafraîchissement du cache RevenueCat
 */
export const isPremiumUser = async (userId, forceRefresh = false) => {
  try {
    // 1. Vérifier avec RevenueCat (source de vérité pour les abonnements)
    // Passer le userId pour s'assurer que l'utilisateur est identifié
    const rcStatus = await checkRevenueCatPremium(forceRefresh, userId);

    if (rcStatus.isPremium) {
      return true;
    }

    // 2. Vérifier Firestore pour premium manuel (défini par admin)
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();

      // Premium manuel explicitement défini par admin
      if (userData.isManualPremium === true) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Erreur vérification premium:', error);
    return false;
  }
};

/**
 * Synchroniser le statut premium avec Firestore
 */
const syncPremiumStatus = async (userId, isPremium, expiresAt = null) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isPremium,
      premiumExpiresAt: expiresAt,
      lastSyncDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Erreur sync Firestore:', error);
  }
};

/**
 * Obtenir les offres disponibles
 */
export const getAvailableSubscriptions = async () => {
  if (!Purchases || isExpoGo) {
    console.log('⚠️ RevenueCat non disponible (Expo Go)');
    return { success: true, products: [], offerings: null, isExpoGo };
  }

  // S'assurer que RevenueCat est initialisé
  await ensureInitialized();

  try {
    const offerings = await Purchases.getOfferings();

    if (offerings.current && offerings.current.availablePackages.length > 0) {
      const packages = offerings.current.availablePackages;
      console.log('📦 Packages disponibles:', packages.map(p => p.identifier));

      return {
        success: true,
        offerings: offerings.current,
        products: packages.map(pkg => ({
          identifier: pkg.identifier,
          productId: pkg.product.identifier,
          title: pkg.product.title,
          description: pkg.product.description,
          price: pkg.product.priceString,
          priceValue: pkg.product.price,
          currency: pkg.product.currencyCode,
          package: pkg,
        })),
      };
    }

    console.log('⚠️ Aucune offre disponible');
    return { success: true, products: [], offerings: null };
  } catch (error) {
    console.error('❌ Erreur récupération offres:', error);
    return { success: false, error: error.message, products: [] };
  }
};

/**
 * Acheter un abonnement
 * @param {string} userId - ID de l'utilisateur Firebase
 * @param {object} packageToPurchase - Package RevenueCat à acheter (optionnel)
 */
export const purchaseSubscription = async (userId, packageToPurchase = null) => {
  if (!Purchases) {
    console.log('⚠️ RevenueCat non disponible');
    return { success: false, error: 'Achats non disponibles', canceled: true };
  }

  try {
    // S'assurer que l'utilisateur est identifié AVANT l'achat
    if (userId) {
      console.log('🔐 Identification de l\'utilisateur avant achat:', userId);
      try {
        const { customerInfo: loginInfo } = await Purchases.logIn(userId);
        console.log('✅ Utilisateur identifié pour l\'achat:', loginInfo.originalAppUserId);
      } catch (loginError) {
        console.log('⚠️ Erreur login (peut-être déjà connecté):', loginError.message);
        // Vérifier quand même l'ID actuel
        const currentInfo = await Purchases.getCustomerInfo();
        console.log('📊 App User ID actuel:', currentInfo.originalAppUserId);
      }
    }

    // Si pas de package fourni, récupérer le premier disponible
    if (!packageToPurchase) {
      const { offerings } = await getAvailableSubscriptions();
      if (offerings && offerings.availablePackages.length > 0) {
        packageToPurchase = offerings.availablePackages[0];
      } else {
        return { success: false, error: 'Aucun produit disponible' };
      }
    }

    console.log('🛒 Achat du package:', packageToPurchase.identifier);

    // Lancer l'achat
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    console.log('📊 CustomerInfo après achat - App User ID:', customerInfo.originalAppUserId);

    // Vérifier si l'entitlement premium est actif
    if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

      // Synchroniser avec Firestore
      await syncPremiumStatus(userId, true, entitlement.expirationDate);

      console.log('✅ Achat réussi !');
      return { success: true };
    }

    return { success: false, error: 'Entitlement non activé' };
  } catch (error) {
    if (error.userCancelled) {
      console.log('ℹ️ Achat annulé par l\'utilisateur');
      return { success: false, error: 'Achat annulé', canceled: true };
    }

    console.error('❌ Erreur achat:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Restaurer les achats
 * @param {string} userId - ID de l'utilisateur Firebase
 */
export const restorePurchases = async (userId) => {
  if (!Purchases) {
    console.log('⚠️ RevenueCat non disponible');
    return { success: true, restored: false };
  }

  // S'assurer que RevenueCat est initialisé
  await ensureInitialized();

  try {
    console.log('🔄 Restauration des achats...');
    const customerInfo = await Purchases.restorePurchases();

    // Vérifier si l'entitlement premium est actif
    if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

      // Synchroniser avec Firestore
      await syncPremiumStatus(userId, true, entitlement.expirationDate);

      console.log('✅ Achats restaurés !');
      return { success: true, restored: true };
    }

    console.log('ℹ️ Aucun achat à restaurer');
    return { success: true, restored: false };
  } catch (error) {
    console.error('❌ Erreur restauration:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtenir le statut complet de l'abonnement
 * @param {string} userId - ID de l'utilisateur Firebase
 */
export const getSubscriptionStatus = async (userId) => {
  try {
    // Vérifier RevenueCat (source de vérité pour les abonnements)
    // Passer le userId pour s'assurer que l'utilisateur est identifié
    const rcStatus = await checkRevenueCatPremium(true, userId); // Force refresh
    console.log('📊 RevenueCat status:', rcStatus);

    // Vérifier Firestore (pour premium manuel uniquement)
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : {};
    console.log('📊 Firestore userData.isPremium:', userData.isPremium, 'isManualPremium:', userData.isManualPremium);

    // Déterminer le statut premium
    let isPremium = false;
    let isManualPremium = false;

    if (rcStatus.isPremium) {
      // Abonnement actif via RevenueCat
      isPremium = true;
      // Sync Firestore
      await syncPremiumStatus(userId, true, rcStatus.expiresAt);
    } else if (userData.isManualPremium === true) {
      // Premium manuel explicitement défini par admin
      isPremium = true;
      isManualPremium = true;
    } else if (userData.isPremium) {
      // Firestore dit premium mais RevenueCat dit non -> synchroniser
      console.log('🔄 Sync: Firestore dit premium mais RevenueCat dit non -> mise à jour');
      await syncPremiumStatus(userId, false, null);
      isPremium = false;
    }

    console.log('📊 Résultat final isPremium:', isPremium);

    return {
      success: true,
      isPremium,
      isSubscribed: rcStatus.isActive,
      isManualPremium,
      expiresAt: rcStatus.expiresAt || null,
      willRenew: rcStatus.willRenew || false,
      productId: rcStatus.productId || null,
    };
  } catch (error) {
    console.error('❌ Erreur récupération statut:', error);
    return {
      success: false,
      isPremium: false,
      isSubscribed: false,
      isManualPremium: false,
      expiresAt: null,
      willRenew: false,
    };
  }
};

/**
 * Ajouter un listener pour les changements de statut
 * @param {function} callback - Fonction appelée lors des changements
 */
export const addPurchaseListener = (callback) => {
  if (!Purchases) return null;

  try {
    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
      callback({ isPremium, customerInfo });
    });

    return true;
  } catch (error) {
    console.error('❌ Erreur ajout listener:', error);
    return null;
  }
};

// Export pour compatibilité avec l'ancien code
export const isInFreeTrial = async () => false;
export const registerFirstLogin = async () => ({ success: true });

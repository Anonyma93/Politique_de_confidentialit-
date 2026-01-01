import { Platform } from 'react-native';
import { isPremiumUser } from './subscriptionService';

// Import conditionnel pour éviter l'erreur avec Expo Go
// DÉSACTIVÉ : Package retiré pour éviter les crashes
let InterstitialAd, AdEventType, TestIds;
// try {
//   const GoogleMobileAds = require('react-native-google-mobile-ads');
//   InterstitialAd = GoogleMobileAds.InterstitialAd;
//   AdEventType = GoogleMobileAds.AdEventType;
//   TestIds = GoogleMobileAds.TestIds;
// } catch (error) {
//   console.warn('Google Mobile Ads non disponible:', error);
// }

// IDs de publicité
// IMPORTANT : Vous devez créer une unité publicitaire "Interstitielle" dans AdMob
// et remplacer l'ID ci-dessous par l'Ad Unit ID (format: ca-app-pub-XXX/YYY avec un slash /)

// MODE TEST : Utilisez true pour tester avec les pubs de test Google
const USE_TEST_ADS = true; // Mettre à false en production

const AD_UNIT_IDS = {
  ios: 'ca-app-pub-4887318056624838/XXXXXXXXXX', // À remplacer par votre Ad Unit ID interstitielle
  android: 'ca-app-pub-XXXXXXXXXX/ZZZZZZZZZZ', // À configurer plus tard
};

// Utiliser les Test IDs si en mode test, sinon les vrais IDs
const AD_UNIT_ID = USE_TEST_ADS && TestIds
  ? TestIds.INTERSTITIAL
  : (Platform.OS === 'ios' ? AD_UNIT_IDS.ios : AD_UNIT_IDS.android);

// Instance de la publicité interstitielle
let interstitialAd = null;
let isAdLoaded = false;
let isAdLoading = false;

/**
 * Créer et charger une publicité interstitielle
 */
const createAndLoadInterstitial = () => {
  return new Promise((resolve, reject) => {
    // Vérifier si les modules sont disponibles
    if (!InterstitialAd || !AdEventType) {
      resolve(false);
      return;
    }

    // Si déjà en cours de chargement, ne pas recharger
    if (isAdLoading) {
      resolve(false);
      return;
    }

    // Si déjà chargée, pas besoin de recharger
    if (isAdLoaded && interstitialAd) {
      resolve(true);
      return;
    }

    try {
      isAdLoading = true;

      // Créer la publicité interstitielle
      interstitialAd = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: false,
      });

      // Écouter les événements
      interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        isAdLoaded = true;
        isAdLoading = false;
        console.log('Publicité chargée');
        resolve(true);
      });

      interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        isAdLoaded = false;
        console.log('Publicité fermée');
        // Recharger une nouvelle pub pour la prochaine fois
        createAndLoadInterstitial();
      });

      interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
        isAdLoading = false;
        isAdLoaded = false;
        console.error('Erreur chargement pub:', error);
        reject(error);
      });

      // Charger la publicité
      interstitialAd.load();
    } catch (error) {
      isAdLoading = false;
      isAdLoaded = false;
      console.error('Erreur création pub:', error);
      reject(error);
    }
  });
};

/**
 * Afficher une publicité interstitielle
 * @param {string} userId - ID de l'utilisateur
 * @param {boolean} forceShow - Forcer l'affichage même si premium (pour test)
 * @returns {Promise<{shown: boolean, reason?: string}>}
 */
export const showInterstitialAd = async (userId, forceShow = false) => {
  try {
    // Ne pas afficher de pub en mode développement (Expo Go)
    if (__DEV__) {
      console.log('Mode développement, pas de pub');
      return { shown: false, reason: 'dev_mode' };
    }

    // Vérifier si l'utilisateur est premium
    if (!forceShow) {
      const isPremium = await isPremiumUser(userId);
      if (isPremium) {
        console.log('Utilisateur premium, pas de pub');
        return { shown: false, reason: 'premium' };
      }
    }

    // Charger la pub si pas encore fait
    if (!isAdLoaded) {
      console.log('Publicité pas encore chargée, chargement...');
      await createAndLoadInterstitial();
    }

    // Afficher la pub si chargée
    if (isAdLoaded && interstitialAd) {
      await interstitialAd.show();
      console.log('Publicité affichée');
      return { shown: true };
    } else {
      console.log('Publicité non disponible');
      return { shown: false, reason: 'not_loaded' };
    }
  } catch (error) {
    console.error('Erreur affichage pub:', error);
    return { shown: false, reason: 'error', error: error.message };
  }
};

/**
 * Pré-charger une publicité pour la prochaine utilisation
 */
export const preloadInterstitialAd = async () => {
  try {
    // Vérifier si les modules sont disponibles
    if (!InterstitialAd || !AdEventType) {
      return;
    }

    if (!isAdLoaded && !isAdLoading) {
      await createAndLoadInterstitial();
      console.log('Publicité pré-chargée');
    }
  } catch (error) {
    console.error('Erreur pré-chargement pub:', error);
  }
};

/**
 * Initialiser le service de publicités
 * À appeler au démarrage de l'app
 */
export const initializeAds = async () => {
  try {
    // Vérifier si les modules sont disponibles
    if (!InterstitialAd || !AdEventType) {
      console.log('Mode dev ou Google Mobile Ads non configuré - publicités désactivées');
      return { success: true, disabled: true };
    }

    // Pré-charger la première pub
    await preloadInterstitialAd();
    return { success: true };
  } catch (error) {
    console.error('Erreur initialisation pubs:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Vérifier si une pub est prête à être affichée
 */
export const isAdReady = () => {
  return isAdLoaded;
};

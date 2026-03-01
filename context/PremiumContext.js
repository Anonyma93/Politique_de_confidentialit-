import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Import conditionnel de RevenueCat
let Purchases = null;
try {
  Purchases = require('react-native-purchases').default;
} catch (error) {
  console.log('⚠️ RevenueCat non disponible dans PremiumContext');
}

const PremiumContext = createContext();

const REVENUECAT_API_KEY_IOS = 'appl_WlbpXfZwhjOxiQaXTxccqqoiehe';
const REVENUECAT_API_KEY_ANDROID = 'goog_IGzZSALIJItcwqJOBGZltwSmHTg'; // goog_XXXXXXXXXXXX
const REVENUECAT_API_KEY = Platform.OS === 'android' ? REVENUECAT_API_KEY_ANDROID : REVENUECAT_API_KEY_IOS;
const ENTITLEMENT_ID = 'premium';

export const PremiumProvider = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const listenerAdded = useRef(false);

  // Vérifier le statut premium
  const checkPremiumStatus = useCallback(async (forceRefresh = false) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      console.log('🔍 checkPremiumStatus appelé, user:', user?.uid, 'forceRefresh:', forceRefresh);

      if (!user) {
        setIsPremium(false);
        setIsLoading(false);
        return false;
      }

      // Vérifier RevenueCat si disponible
      if (Purchases) {
        try {
          // S'assurer que l'utilisateur est identifié
          console.log('🔐 Identification de l\'utilisateur:', user.uid);
          try {
            const { customerInfo: loginInfo } = await Purchases.logIn(user.uid);
            console.log('✅ Utilisateur identifié:', loginInfo.originalAppUserId);
          } catch (loginError) {
            console.log('ℹ️ Login (peut-être déjà connecté):', loginError.message);
          }

          // Invalider le cache si force refresh
          if (forceRefresh) {
            await Purchases.invalidateCustomerInfoCache();
          }

          const customerInfo = await Purchases.getCustomerInfo();
          console.log('📊 App User ID:', customerInfo.originalAppUserId);
          console.log('📊 CustomerInfo entitlements:', Object.keys(customerInfo.entitlements.active));
          const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

          if (entitlement) {
            console.log('✅ Premium actif via RevenueCat');
            setIsPremium(true);
            setIsLoading(false);
            return true;
          }
        } catch (error) {
          console.log('⚠️ Erreur RevenueCat:', error.message);
        }
      }

      // Vérifier Firestore pour premium manuel
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.isManualPremium === true) {
          console.log('✅ Premium manuel actif');
          setIsPremium(true);
          setIsLoading(false);
          return true;
        }
      }

      console.log('❌ Pas de premium actif');
      setIsPremium(false);
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('❌ Erreur vérification premium:', error);
      setIsPremium(false);
      setIsLoading(false);
      return false;
    }
  }, []);

  // Initialiser RevenueCat et le listener
  useEffect(() => {
    const initializeRevenueCat = async () => {
      console.log('🚀 Initialisation PremiumContext...');

      if (!Purchases) {
        console.log('⚠️ RevenueCat non disponible');
        await checkPremiumStatus();
        return;
      }

      try {
        // Configurer RevenueCat (si pas déjà fait)
        try {
          await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
          console.log('✅ RevenueCat configuré dans PremiumContext');
        } catch (configError) {
          // RevenueCat peut déjà être configuré dans subscriptionService
          console.log('ℹ️ RevenueCat peut-être déjà configuré:', configError.message);
        }

        // Identifier l'utilisateur si connecté
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          try {
            await Purchases.logIn(user.uid);
            console.log('✅ Utilisateur identifié:', user.uid);
          } catch (loginError) {
            console.log('ℹ️ Erreur logIn (peut-être déjà connecté):', loginError.message);
          }
        }

        // Ajouter le listener pour les changements en temps réel (une seule fois)
        if (!listenerAdded.current) {
          console.log('🔔 Ajout du listener CustomerInfo...');

          Purchases.addCustomerInfoUpdateListener((customerInfo) => {
            console.log('🔔🔔🔔 CustomerInfo MIS À JOUR! 🔔🔔🔔');
            console.log('📊 Entitlements actifs:', Object.keys(customerInfo.entitlements.active));

            const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
            const newPremiumStatus = !!entitlement;

            console.log('📊 Nouveau statut premium:', newPremiumStatus);

            // Mettre à jour le state directement (PremiumProvider ne se démonte jamais)
            setIsPremium(newPremiumStatus);

            // Synchroniser avec Firestore (récupérer l'user actuel)
            const currentAuth = getAuth();
            const currentUser = currentAuth.currentUser;
            if (currentUser) {
              updateDoc(doc(db, 'users', currentUser.uid), {
                isPremium: newPremiumStatus,
                premiumExpiresAt: entitlement?.expirationDate || null,
                lastSyncDate: new Date().toISOString(),
              }).catch(err => console.log('Erreur sync Firestore:', err));
            }
          });

          listenerAdded.current = true;
          console.log('✅ Listener CustomerInfo ajouté');
        }

        setIsInitialized(true);
        await checkPremiumStatus();
      } catch (error) {
        console.error('❌ Erreur init RevenueCat:', error);
        await checkPremiumStatus();
      }
    };

    initializeRevenueCat();

    // Écouter les changements d'authentification
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('👤 Auth state changed:', user?.uid);
      if (user && Purchases) {
        try {
          await Purchases.logIn(user.uid);
          await checkPremiumStatus(true); // Force refresh après login
        } catch (error) {
          console.error('Erreur logIn après auth change:', error);
        }
      } else if (!user) {
        setIsPremium(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [checkPremiumStatus]);

  // Vérifier le statut quand l'app revient au premier plan + vérification périodique
  useEffect(() => {
    let intervalId = null;
    let currentAppState = AppState.currentState;

    const startPeriodicCheck = () => {
      // Vérifier toutes les 30 secondes quand l'app est active
      if (!intervalId) {
        intervalId = setInterval(() => {
          console.log('⏰ Vérification périodique du statut premium');
          checkPremiumStatus(true);
        }, 30000);
      }
    };

    const stopPeriodicCheck = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && currentAppState !== 'active') {
        console.log('📱 App au premier plan - vérification premium (force refresh)');
        checkPremiumStatus(true);
        startPeriodicCheck();
      } else if (nextAppState !== 'active') {
        stopPeriodicCheck();
      }
      currentAppState = nextAppState;
    });

    // Démarrer la vérification périodique si l'app est déjà active
    if (currentAppState === 'active') {
      startPeriodicCheck();
    }

    return () => {
      subscription?.remove();
      stopPeriodicCheck();
    };
  }, [checkPremiumStatus]);

  // Fonction pour forcer le rafraîchissement
  const refreshPremiumStatus = useCallback(async () => {
    console.log('🔄 refreshPremiumStatus appelé');
    setIsLoading(true);
    return await checkPremiumStatus(true); // Force refresh
  }, [checkPremiumStatus]);

  // Debug: Log quand isPremium change
  useEffect(() => {
    console.log('💎💎💎 PREMIUM STATUS CHANGED:', isPremium, '💎💎💎');
  }, [isPremium]);

  return (
    <PremiumContext.Provider value={{
      isPremium,
      isLoading,
      refreshPremiumStatus,
      checkPremiumStatus,
    }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium doit être utilisé dans un PremiumProvider');
  }
  return context;
};

export default PremiumContext;

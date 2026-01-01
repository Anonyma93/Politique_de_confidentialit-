import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const WalkthroughContext = createContext();

// Définition des étapes du walkthrough pour chaque écran
export const WALKTHROUGH_STEPS = {
  HOME: {
    INTRODUCTION: 'home_introduction',
    IMPACTED_LINES: 'home_impacted_lines',
    CREATE_POST: 'home_create_post',
    QUICK_FILTERS: 'home_quick_filters',
  },
  FEED: {
    FILTER_BUTTONS: 'feed_filter_buttons',
    POST_INTERACTION: 'feed_post_interaction',
    SEVERITY_BADGES: 'feed_severity_badges',
    USER_PROFILE_CLICK: 'feed_user_profile_click',
    POST_DETAILS: 'feed_post_details',
    RESET_INFO: 'feed_reset_info',
  },
  PROFILE: {
    GRADE_BADGE: 'profile_grade_badge',
    PREFERENCES: 'profile_preferences',
    THEME_SETTINGS: 'profile_theme_settings',
  },
  POST: {
    LINE_SELECTION: 'post_line_selection',
    SEVERITY: 'post_severity',
    SUBMIT: 'post_submit',
    INTRODUCTION: 'post_introduction',
  },
  SETTINGS: {
    INTRODUCTION: 'settings_introduction',
    THEME_MODE: 'settings_theme_mode',
    NOTIFICATIONS: 'settings_notifications',
  },
};

export const WalkthroughProvider = ({ children }) => {
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    loadWalkthroughState();

    // Écouter les changements d'authentification
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // L'utilisateur vient de se connecter, recharger l'état
        loadWalkthroughState();
      }
    });

    return () => unsubscribe();
  }, []);

  // Charger l'état du walkthrough depuis AsyncStorage et Firestore
  const loadWalkthroughState = async () => {
    try {
      setIsLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;

      let shouldShowWalkthrough = false;
      let firstTime = true;
      let steps = [];

      // Si l'utilisateur est connecté, charger depuis Firestore en priorité
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Vérifier si les champs walkthrough existent
          if (userData.walkthroughCompleted !== undefined) {
            firstTime = !userData.walkthroughCompleted;
            steps = userData.walkthroughSteps || [];
            shouldShowWalkthrough = firstTime && steps.length === 0;
          } else {
            // Champs walkthrough n'existent pas - nouveau compte ou ancien compte
            firstTime = true;
            steps = [];
            shouldShowWalkthrough = true;
          }
        } else {
          // Document n'existe pas encore - nouveau compte
          firstTime = true;
          steps = [];
          shouldShowWalkthrough = true;
        }
      } else {
        // Pas d'utilisateur connecté - charger depuis AsyncStorage
        const localState = await AsyncStorage.getItem('walkthroughState');
        if (localState) {
          const { isFirstTime: localFirstTime, completedSteps: localSteps } = JSON.parse(localState);
          firstTime = localFirstTime;
          steps = localSteps || [];
          shouldShowWalkthrough = firstTime && steps.length === 0;
        }
      }

      // Mettre à jour tous les états
      setIsFirstTime(firstTime);
      setCompletedSteps(steps);
      setShowWalkthrough(shouldShowWalkthrough);
    } catch (error) {
      console.error('Erreur lors du chargement du walkthrough:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sauvegarder l'état du walkthrough
  const saveWalkthroughState = async (firstTime, steps) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      // Sauvegarder dans AsyncStorage
      await AsyncStorage.setItem('walkthroughState', JSON.stringify({
        isFirstTime: firstTime,
        completedSteps: steps,
      }));

      // Sauvegarder dans Firestore si connecté
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          walkthroughCompleted: !firstTime,
          walkthroughSteps: steps,
        }, { merge: true });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du walkthrough:', error);
    }
  };

  // Marquer une étape comme complétée
  const completeStep = async (stepId) => {
    if (!completedSteps.includes(stepId)) {
      const newSteps = [...completedSteps, stepId];
      setCompletedSteps(newSteps);
      await saveWalkthroughState(isFirstTime, newSteps);
    }
  };

  // Marquer le walkthrough comme terminé
  const completeWalkthrough = async () => {
    setIsFirstTime(false);
    setShowWalkthrough(false);
    await saveWalkthroughState(false, completedSteps);
  };

  // Réinitialiser le walkthrough (pour le rejouer)
  const resetWalkthrough = async () => {
    setIsFirstTime(true);
    setCompletedSteps([]);
    setShowWalkthrough(true);
    await saveWalkthroughState(true, []);
  };

  // Vérifier si une étape a été complétée
  const isStepCompleted = (stepId) => {
    return completedSteps.includes(stepId);
  };

  // Désactiver temporairement le walkthrough
  const dismissWalkthrough = () => {
    setShowWalkthrough(false);
  };

  // Activer le walkthrough
  const startWalkthrough = () => {
    setShowWalkthrough(true);
  };

  return (
    <WalkthroughContext.Provider value={{
      isFirstTime,
      completedSteps,
      showWalkthrough,
      isLoading,
      completeStep,
      completeWalkthrough,
      resetWalkthrough,
      isStepCompleted,
      dismissWalkthrough,
      startWalkthrough,
    }}>
      {children}
    </WalkthroughContext.Provider>
  );
};

export const useWalkthrough = () => {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough doit être utilisé dans un WalkthroughProvider');
  }
  return context;
};

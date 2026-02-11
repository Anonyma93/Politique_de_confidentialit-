import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAllScreenNames } from '../config/screenGuideConfig';

const ScreenGuideContext = createContext();

// Nouvelles clés
const STORAGE_KEY_VISITED_SCREENS = 'screenGuideVisitedScreens';
const STORAGE_KEY_IS_ENABLED = 'walkthroughIsEnabled';
const STORAGE_KEY_PERMANENTLY_DISABLED = 'walkthroughPermanentlyDisabled';

// Anciennes clés (rétrocompatibilité)
const LEGACY_STORAGE_KEY = 'walkthroughCompleted';
const LEGACY_COMPLETED_STEPS_KEY = 'walkthroughCompletedSteps';

/**
 * Mapper les anciens step IDs vers leurs écrans respectifs.
 * Renvoie un Set d'écrans dont TOUS les steps sont complétés.
 */
const STEP_TO_SCREEN = {
  home_welcome: 'Home',
  home_lines: 'Home',
  feed_filters: 'Feed',
  feed_reset: 'Feed',
  post_create: 'Post',
  profile_ranking: 'Profile',
  options_settings: 'Options',
  options_theme: 'Options',
  options_notifications: 'Options',
};

const STEPS_PER_SCREEN = {};
Object.entries(STEP_TO_SCREEN).forEach(([stepId, screen]) => {
  if (!STEPS_PER_SCREEN[screen]) STEPS_PER_SCREEN[screen] = [];
  STEPS_PER_SCREEN[screen].push(stepId);
});

const migrateCompletedStepsToScreens = (completedSteps) => {
  const visited = new Set();
  Object.entries(STEPS_PER_SCREEN).forEach(([screen, steps]) => {
    if (steps.every((s) => completedSteps.has(s))) {
      visited.add(screen);
    }
  });
  return visited;
};

export const ScreenGuideProvider = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [visitedScreens, setVisitedScreens] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadState();

    const auth = getAuth();
    let previousUserId = auth.currentUser?.uid;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      const currentUserId = user?.uid;
      if (currentUserId !== previousUserId) {
        previousUserId = currentUserId;
        if (user) {
          loadState();
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loadState = async () => {
    try {
      setIsLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;

      let loadedVisited = new Set();
      let loadedIsEnabled = true;

      // PRIORITÉ 1 : flag de désactivation permanente
      const permanentlyDisabled = await AsyncStorage.getItem(STORAGE_KEY_PERMANENTLY_DISABLED);
      if (permanentlyDisabled === 'true') {
        setIsEnabled(false);
        setVisitedScreens(new Set(getAllScreenNames()));
        setIsLoading(false);
        return;
      }

      // PRIORITÉ 2 : ancienne clé legacy (walkthroughCompleted)
      const legacyCompleted = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyCompleted === 'true') {
        loadedIsEnabled = false;
        loadedVisited = new Set(getAllScreenNames());
        // Migrer
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
        await AsyncStorage.setItem(STORAGE_KEY_IS_ENABLED, 'false');
        await AsyncStorage.setItem(STORAGE_KEY_PERMANENTLY_DISABLED, 'true');
        await AsyncStorage.setItem(STORAGE_KEY_VISITED_SCREENS, JSON.stringify([...loadedVisited]));
        setIsEnabled(false);
        setVisitedScreens(loadedVisited);
        setIsLoading(false);
        return;
      }

      if (user) {
        // Utilisateur connecté – Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();

          // Migration ancienne donnée Firestore walkthroughCompleted
          if (userData.walkthroughCompleted === true && !userData.walkthroughCompletedSteps && !userData.screenGuideVisitedScreens) {
            loadedIsEnabled = false;
            loadedVisited = new Set(getAllScreenNames());
          }
          // Nouveau format déjà présent
          else if (userData.screenGuideVisitedScreens && Array.isArray(userData.screenGuideVisitedScreens)) {
            loadedIsEnabled = userData.walkthroughIsEnabled !== false;
            loadedVisited = new Set(userData.screenGuideVisitedScreens);
          }
          // Ancien format walkthroughCompletedSteps
          else if (userData.walkthroughCompletedSteps && Array.isArray(userData.walkthroughCompletedSteps)) {
            const completedSteps = new Set(userData.walkthroughCompletedSteps);
            const allOldSteps = Object.keys(STEP_TO_SCREEN);
            if (allOldSteps.every((s) => completedSteps.has(s))) {
              // Tous les steps sont faits → désactiver
              loadedIsEnabled = false;
              loadedVisited = new Set(getAllScreenNames());
            } else {
              // Migration partielle
              loadedIsEnabled = userData.walkthroughIsEnabled !== false;
              loadedVisited = migrateCompletedStepsToScreens(completedSteps);
            }
          } else {
            loadedIsEnabled = userData.walkthroughIsEnabled !== false;
          }
        }
      } else {
        // Pas d'utilisateur – AsyncStorage
        const localEnabled = await AsyncStorage.getItem(STORAGE_KEY_IS_ENABLED);
        const localVisited = await AsyncStorage.getItem(STORAGE_KEY_VISITED_SCREENS);
        // Aussi vérifier l'ancien format local
        const localLegacySteps = await AsyncStorage.getItem(LEGACY_COMPLETED_STEPS_KEY);

        if (localEnabled !== null) {
          loadedIsEnabled = localEnabled === 'true';
        }

        if (localVisited) {
          try {
            loadedVisited = new Set(JSON.parse(localVisited));
          } catch (e) {
            console.error('Erreur parsing visitedScreens:', e);
          }
        } else if (localLegacySteps) {
          // Migration depuis les anciens steps locaux
          try {
            const completedSteps = new Set(JSON.parse(localLegacySteps));
            const allOldSteps = Object.keys(STEP_TO_SCREEN);
            if (allOldSteps.every((s) => completedSteps.has(s))) {
              loadedIsEnabled = false;
              loadedVisited = new Set(getAllScreenNames());
            } else {
              loadedVisited = migrateCompletedStepsToScreens(completedSteps);
            }
          } catch (e) {
            console.error('Erreur parsing legacy completedSteps:', e);
          }
        }
      }

      setIsEnabled(loadedIsEnabled);
      setVisitedScreens(loadedVisited);
    } catch (error) {
      console.error('Erreur lors du chargement du guide:', error);
      setIsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveState = async (newIsEnabled, newVisited) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      const visitedArray = [...newVisited];

      await AsyncStorage.setItem(STORAGE_KEY_IS_ENABLED, newIsEnabled.toString());
      await AsyncStorage.setItem(STORAGE_KEY_VISITED_SCREENS, JSON.stringify(visitedArray));

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(
          userDocRef,
          {
            walkthroughIsEnabled: newIsEnabled,
            screenGuideVisitedScreens: visitedArray,
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du guide:', error);
    }
  };

  const shouldShowGuide = useCallback(
    (screenName) => {
      return isEnabled && !isLoading && !visitedScreens.has(screenName);
    },
    [isEnabled, isLoading, visitedScreens]
  );

  const markScreenVisited = useCallback(
    async (screenName) => {
      const newVisited = new Set([...visitedScreens, screenName]);
      setVisitedScreens(newVisited);

      // Vérifier si tous les écrans ont été visités
      const allScreens = getAllScreenNames();
      const allVisited = allScreens.every((s) => newVisited.has(s));

      if (allVisited) {
        setIsEnabled(false);
        await AsyncStorage.setItem(STORAGE_KEY_PERMANENTLY_DISABLED, 'true');
      }

      await saveState(allVisited ? false : isEnabled, newVisited);
    },
    [visitedScreens, isEnabled]
  );

  const disableAllGuides = useCallback(async () => {
    setIsEnabled(false);
    await AsyncStorage.setItem(STORAGE_KEY_PERMANENTLY_DISABLED, 'true');
    await saveState(false, visitedScreens);
  }, [visitedScreens]);

  const resetGuides = useCallback(async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      setVisitedScreens(new Set());
      setIsEnabled(true);

      await AsyncStorage.removeItem(STORAGE_KEY_VISITED_SCREENS);
      await AsyncStorage.removeItem(STORAGE_KEY_PERMANENTLY_DISABLED);
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      await AsyncStorage.removeItem(LEGACY_COMPLETED_STEPS_KEY);
      await AsyncStorage.setItem(STORAGE_KEY_IS_ENABLED, 'true');

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(
          userDocRef,
          {
            walkthroughIsEnabled: true,
            screenGuideVisitedScreens: [],
            walkthroughCompleted: false,
            walkthroughCompletedSteps: [],
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du guide:', error);
    }
  }, []);

  return (
    <ScreenGuideContext.Provider
      value={{
        isEnabled,
        isLoading,
        visitedScreens,
        shouldShowGuide,
        markScreenVisited,
        disableAllGuides,
        resetGuides,
      }}
    >
      {children}
    </ScreenGuideContext.Provider>
  );
};

export const useScreenGuide = () => {
  const context = useContext(ScreenGuideContext);
  if (!context) {
    throw new Error('useScreenGuide doit être utilisé dans un ScreenGuideProvider');
  }
  return context;
};

import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './context/ThemeContext';
import { ScreenGuideProvider } from './context/ScreenGuideContext';
import { PremiumProvider } from './context/PremiumContext';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { ActivityIndicator, View, Text } from 'react-native';
import { initializeAds } from './services/adService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './config/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { updateBadgeForPreferredLines } from './services/badgeService';

// Gestionnaire d'erreurs global
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('💥 ERREUR GLOBALE:', {
    error: error.toString(),
    stack: error.stack,
    isFatal
  });
});

// Import des écrans
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import PremiumScreen from './screens/PremiumScreen';
import TabNavigator from './navigation/TabNavigator';

const Stack = createNativeStackNavigator();

export default function App() {
  console.log('🚀 App: Démarrage de l\'application');

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
  });

  console.log('📝 App: Fonts loaded:', fontsLoaded);

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const notificationListener = useRef();
  const responseListener = useRef();

  // Initialiser les publicités au démarrage (désactivé temporairement)
  // useEffect(() => {
  //   initializeAds();
  // }, []);

  // Configurer les listeners de notifications
  useEffect(() => {
    console.log('🔔 App: Configuration des listeners de notifications');

    // Écouter les notifications reçues en premier plan
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 App: Notification reçue!', notification);
    });

    // Écouter les interactions avec les notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 App: Notification cliquée!', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Écouter les changements d'état d'authentification
  useEffect(() => {
    console.log('🔐 App: Configuration de l\'auth listener');
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('👤 App: Auth state changed, user:', user ? user.uid : 'null');
        setUser(user);
        if (initializing) setInitializing(false);
      });

      console.log('✅ App: Auth listener configuré avec succès');
      // Cleanup subscription on unmount
      return unsubscribe;
    } catch (error) {
      console.error('❌ App: Erreur lors de la configuration de l\'auth listener:', error);
      setInitializing(false);
    }
  }, [initializing]);

  // Écouter les posts en temps réel pour mettre à jour le badge des lignes favorites
  useEffect(() => {
    if (!user) {
      return;
    }

    console.log('🔔 App: Configuration du badge listener pour les lignes favorites');

    let postsUnsubscribe = null;
    let preferredLines = [];

    // Charger les lignes préférées de l'utilisateur
    const loadPreferredLines = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          preferredLines = userData.preferredLines || [];
          console.log('🚇 App: Lignes préférées chargées:', preferredLines);
        }
      } catch (error) {
        console.error('❌ App: Erreur lors du chargement des lignes préférées:', error);
      }
    };

    // Écouter les posts en temps réel
    const setupPostsListener = async () => {
      await loadPreferredLines();

      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );

      postsUnsubscribe = onSnapshot(postsQuery, async (snapshot) => {
        const posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Mettre à jour le badge avec le nombre de posts sur les lignes favorites
        if (preferredLines.length > 0) {
          await updateBadgeForPreferredLines(posts, preferredLines);
        }
      });
    };

    setupPostsListener();

    return () => {
      if (postsUnsubscribe) {
        postsUnsubscribe();
      }
    };
  }, [user]);

  if (!fontsLoaded || initializing) {
    console.log('⏳ App: Chargement... Fonts:', fontsLoaded, 'Initializing:', initializing);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  console.log('✨ App: Rendu de la navigation, user:', user ? 'connecté' : 'non connecté');

  return (
    <ThemeProvider>
      <PremiumProvider>
        <ScreenGuideProvider>
          <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator initialRouteName={user ? "Main" : "Login"}>
            {user ? (
              // Utilisateur connecté
              <>
                {/* Pages principales avec bottom tabs */}
                <Stack.Screen
                  name="Main"
                  component={TabNavigator}
                  options={{ headerShown: false }}
                />

                {/* Page d'inscription/onboarding */}
                <Stack.Screen
                  name="Onboarding"
                  component={OnboardingScreen}
                  options={{ headerShown: false }}
                />

                {/* Page de profil utilisateur */}
                <Stack.Screen
                  name="UserProfile"
                  component={UserProfileScreen}
                  options={{ headerShown: false }}
                />

                {/* Page de politique de confidentialité */}
                <Stack.Screen
                  name="PrivacyPolicy"
                  component={PrivacyPolicyScreen}
                  options={{ headerShown: false }}
                />

                {/* Page Premium */}
                <Stack.Screen
                  name="Premium"
                  component={PremiumScreen}
                  options={{ headerShown: false }}
                />
              </>
            ) : (
              // Utilisateur non connecté
              <>
                {/* Page de connexion */}
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ headerShown: false }}
                />

                {/* Page d'inscription/onboarding */}
                <Stack.Screen
                  name="Onboarding"
                  component={OnboardingScreen}
                  options={{ headerShown: false }}
                />

                {/* Page de politique de confidentialité */}
                <Stack.Screen
                  name="PrivacyPolicy"
                  component={PrivacyPolicyScreen}
                  options={{ headerShown: false }}
                />
              </>
            )}
          </Stack.Navigator>
          </NavigationContainer>
        </ScreenGuideProvider>
      </PremiumProvider>
    </ThemeProvider>
  );
}

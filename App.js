import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './context/ThemeContext';
import { WalkthroughProvider } from './context/WalkthroughContext';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { ActivityIndicator, View, Text } from 'react-native';
import { initializeAds } from './services/adService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';

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

  // Initialiser les publicités au démarrage (désactivé temporairement)
  // useEffect(() => {
  //   initializeAds();
  // }, []);

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
      <WalkthroughProvider>
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
      </WalkthroughProvider>
    </ThemeProvider>
  );
}

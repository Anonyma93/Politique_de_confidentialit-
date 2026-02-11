import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { signIn, signInWithApple } from '../services/authService';
import { registerForPushNotifications } from '../services/notificationService';
import { useResponsive } from '../utils/responsive';
import * as AppleAuthentication from 'expo-apple-authentication';
// import { showInterstitialAd } from '../services/adService';



export default function LoginScreen({ navigation }) {
  const { theme, fontSize } = useTheme();
  const { isTablet, maxContentWidth } = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Valeurs animées
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(30)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  // Vérifier la disponibilité de Sign In with Apple
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      setAppleAuthAvailable(isAvailable);
    };
    checkAppleAuthAvailability();
  }, []);

  // Animations au montage
  useEffect(() => {
    Animated.sequence([
      // Logo apparaît en premier
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // Puis titre
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Puis sous-titre
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Enfin le formulaire
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.success) {
      // Enregistrer le token FCM pour les notifications push
      await registerForPushNotifications(result.user.uid);

      // Afficher une publicité pour les utilisateurs non-premium
      // await showInterstitialAd(result.user.uid);

      navigation.replace('Main');
    } else {
      Alert.alert('Erreur de connexion', result.error || 'Email ou mot de passe incorrect');
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    const result = await signInWithApple();
    setLoading(false);

    if (result.success) {
      // Enregistrer le token FCM pour les notifications push
      await registerForPushNotifications(result.user.uid);

      // Si c'est un nouvel utilisateur, rediriger vers l'onboarding pour compléter le profil
      if (result.isNewUser) {
        navigation.navigate('Onboarding', {
          mode: 'complete',
          userData: {
            firstName: result.user.displayName?.split(' ')[0] || 'Utilisateur',
            lastName: result.user.displayName?.split(' ')[1] || 'Apple',
            email: result.user.email,
            photoURL: result.user.photoURL,
          },
        });
      } else {
        navigation.replace('Main');
      }
    } else if (!result.canceled) {
      Alert.alert('Erreur de connexion', result.error || 'Une erreur est survenue');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { backgroundColor: '#C9F2DF' }]}>
        <View style={[styles.contentContainer, { maxWidth: maxContentWidth, width: '100%' }]}>
          {/* Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../logosansfond.png')}
              style={{ width: isTablet ? 200 : 250, height: isTablet ? 200 : 250 }}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text
            style={[
              styles.title,
              {
                color: theme.colors.text,
                fontSize: fontSize.sizes.title,
                fontFamily: 'Fredoka_600SemiBold',
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            Bienvenue sur Lini
          </Animated.Text>
          <Animated.Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.textSecondary,
                fontSize: fontSize.sizes.body,
                fontFamily: 'Fredoka_400Regular',
                opacity: subtitleOpacity,
                transform: [{ translateY: subtitleTranslateY }],
              },
            ]}
          >
            Connectez-vous à votre compte
          </Animated.Text>

          <Animated.View
            style={{
              width: '100%',
              opacity: formOpacity,
              transform: [{ translateY: formTranslateY }],
            }}
          >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.navbar,
                color: theme.colors.text,
                borderColor: theme.colors.border,
                fontSize: fontSize.sizes.body,
                fontFamily: 'Fredoka_400Regular',
              },
            ]}
            placeholder="Adresse email"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                {
                  backgroundColor: theme.colors.navbar,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  fontSize: fontSize.sizes.body,
                  fontFamily: 'Fredoka_400Regular',
                },
              ]}
              placeholder="Mot de passe"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={22}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Bouton de connexion */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.iconActive }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: fontSize.sizes.body, fontFamily: 'Fredoka_600SemiBold' },
                ]}
              >
                Se connecter
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Text
              style={[
                styles.dividerText,
                { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small },
              ]}
            >
              ou
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Bouton Sign in with Apple */}
          {appleAuthAvailable && (
            <TouchableOpacity
              style={[
                styles.appleButton,
                {
                  backgroundColor: theme.name === 'dark' ? '#FFFFFF' : '#000000',
                  borderColor: theme.name === 'dark' ? '#000000' : '#FFFFFF',
                }
              ]}
              onPress={handleAppleSignIn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="logo-apple"
                size={22}
                color={theme.name === 'dark' ? '#000000' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.appleButtonText,
                  {
                    color: theme.name === 'dark' ? '#000000' : '#FFFFFF',
                    fontSize: fontSize.sizes.body,
                    fontFamily: 'Fredoka_600SemiBold',
                  },
                ]}
              >
                Continuer avec Apple
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.signupButton,
              { borderColor: theme.colors.iconActive, backgroundColor: theme.colors.navbar },
            ]}
            onPress={() => navigation.navigate('Onboarding')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.signupButtonText,
                {
                  color: theme.colors.iconActive,
                  fontSize: fontSize.sizes.body,
                  fontFamily: 'Fredoka_600SemiBold',
                },
              ]}
            >
              Créer un compte
            </Text>
          </TouchableOpacity>
        </Animated.View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'center',
  },
  logoContainer: {
    marginBottom: -50,
    overflow: 'hidden',
  },
  title: {
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 15,
  },
  passwordContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 15,
    fontFamily: 'Fredoka_400Regular',
  },
  appleButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    flexDirection: 'row',
    gap: 10,
  },
  appleButtonText: {
    // color is set dynamically
  },
  signupButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  signupButtonText: {
    // color is set dynamically
  },
});

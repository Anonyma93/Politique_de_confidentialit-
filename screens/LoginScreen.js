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
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { signIn, signInWithApple, isAppleAuthAvailable } from '../services/authService';
// import { showInterstitialAd } from '../services/adService';


// Composant Logo Lini
const LiniLogo = ({ size = 120 }) => (
  <Svg width={size} height={size} viewBox="0 0 1000 1000" fill="none">
    <Path
      d="M394.039 606H220.309C217.574 606 215.035 605.512 212.691 604.535C210.348 603.559 208.297 602.24 206.539 600.58C204.879 598.822 203.561 596.771 202.584 594.428C201.607 592.084 201.119 589.545 201.119 586.811V395.941H239.205V567.914H394.039V606ZM714.84 589.74C714.84 592.475 714.303 595.014 713.229 597.357C712.252 599.701 710.885 601.752 709.127 603.51C707.467 605.17 705.465 606.488 703.121 607.465C700.777 608.441 698.287 608.93 695.65 608.93C693.307 608.93 690.914 608.49 688.473 607.611C686.129 606.732 684.029 605.316 682.174 603.363L543.014 458.051V606H504.928V412.201C504.928 408.295 506.002 404.779 508.15 401.654C510.396 398.432 513.229 396.039 516.646 394.477C520.26 393.012 523.971 392.67 527.779 393.451C531.588 394.135 534.859 395.893 537.594 398.725L676.754 543.891V395.941H714.84V589.74Z"
      fill="#033540"
    />
    <Path
      d="M460.396 606H422.311V395.941H460.396V606ZM797.604 606H759.518V395.941H797.604V606Z"
      fill="white"
    />
    <Rect x="319" y="631" width="363" height="9" fill="white" />
    <Rect x="319" y="360" width="363" height="9" fill="#033540" />
  </Svg>
);

export default function LoginScreen({ navigation }) {
  const { theme, fontSize } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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

  // Vérifier la disponibilité d'Apple Auth
  useEffect(() => {
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

  const checkAppleAuthAvailability = async () => {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.success) {
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
      // Si c'est un nouvel utilisateur OU si le profil n'est pas complet
      // (pas de lignes/stations préférées), rediriger vers l'onboarding
      if (result.isNewUser || result.profileIncomplete) {
        navigation.replace('Onboarding', {
          mode: 'complete',
          appleAuth: true,
          userData: result.userData
        });
      } else {
        // Afficher une publicité pour les utilisateurs non-premium
        // await showInterstitialAd(result.user.uid);

        navigation.replace('Main');
      }
    } else if (!result.canceled) {
      Alert.alert('Erreur', result.error || 'Erreur lors de la connexion avec Apple');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { backgroundColor: theme.name === 'normal' ? theme.colors.primary : theme.colors.background }]}>
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
          <LiniLogo size={250} />
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
            placeholder="Mot de passe"
            placeholderTextColor={theme.colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Boutons de connexion côte à côte */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.buttonHalf, { backgroundColor: theme.colors.iconActive }]}
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

            {appleAuthAvailable && (
              <TouchableOpacity
                style={[
                  styles.buttonHalf,
                  styles.appleButtonCustom,
                  { backgroundColor: theme.name === 'dark' ? '#FFFFFF' : '#000000' }
                ]}
                onPress={handleAppleSignIn}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="logo-apple"
                  size={20}
                  color={theme.name === 'dark' ? '#000000' : '#FFFFFF'}
                  style={styles.appleIcon}
                />
                <Text
                  style={[
                    styles.buttonText,
                    {
                      fontSize: fontSize.sizes.body,
                      fontFamily: 'Fredoka_600SemiBold',
                      color: theme.name === 'dark' ? '#000000' : '#FFFFFF'
                    },
                  ]}
                >
                  Apple
                </Text>
              </TouchableOpacity>
            )}
          </View>

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
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
  buttonHalf: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  appleButtonCustom: {
    backgroundColor: '#000',
  },
  appleIcon: {
    marginRight: 6,
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

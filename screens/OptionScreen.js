import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, fontSizes } from '../context/ThemeContext';
import { useWalkthrough, WALKTHROUGH_STEPS } from '../context/WalkthroughContext';
import WalkthroughTooltip from '../components/WalkthroughTooltip';
import { logout, changePassword, deleteAccount, getCurrentUser } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { requestNotificationPermissions } from '../services/notificationService';
import { LinearGradient } from 'expo-linear-gradient';
import { activatePremiumForUser } from '../utils/activatePremiumDev';

export default function OptionScreen() {
  const { theme, changeTheme, fontSize, changeFontSize } = useTheme();
  const { resetWalkthrough } = useWalkthrough();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const currentUser = getCurrentUser();

  // Refs pour le scroll automatique vers les tooltips
  const scrollViewRef = useRef(null);
  const introRef = useRef(null);
  const themeRef = useRef(null);
  const notificationsRef = useRef(null);

  // États pour le modal de changement de mot de passe
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // États pour les notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedSeverities, setSelectedSeverities] = useState(['perturbe', 'tres_perturbe', 'interrompu']);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]); // Lundi à Vendredi par défaut
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(18);

  // État pour la ville
  const [selectedCities, setSelectedCities] = useState(['Paris']);
  const [isPremium, setIsPremium] = useState(false);

  const themeOptions = [
    { key: 'light', icon: 'sunny', label: 'Clair' },
    { key: 'normal', icon: 'partly-sunny', label: 'Normal' },
    { key: 'dark', icon: 'moon', label: 'Sombre' },
  ];

  const fontSizeOptions = [
    { key: 'small', icon: 'text', label: 'Petit', iconSize: 20 },
    { key: 'normal', icon: 'text', label: 'Normal', iconSize: 26 },
    { key: 'large', icon: 'text', label: 'Grand', iconSize: 32 },
  ];

  const severityOptions = [
    { key: 'sans', label: 'Sans', color: '#8CE9F6', icon: 'checkmark-circle' },
    { key: 'minime', label: 'Minime', color: '#9FFFB4', icon: 'information-circle' },
    { key: 'perturbe', label: 'Perturbé', color: '#EBD6C3', icon: 'alert-circle' },
    { key: 'tres_perturbe', label: 'Très perturbé', color: '#F69B4C', icon: 'warning' },
    { key: 'interrompu', label: 'Interrompu', color: '#BE1313', icon: 'close-circle' },
  ];

  const daysOfWeek = [
    { key: 1, label: 'Lun', fullLabel: 'Lundi' },
    { key: 2, label: 'Mar', fullLabel: 'Mardi' },
    { key: 3, label: 'Mer', fullLabel: 'Mercredi' },
    { key: 4, label: 'Jeu', fullLabel: 'Jeudi' },
    { key: 5, label: 'Ven', fullLabel: 'Vendredi' },
    { key: 6, label: 'Sam', fullLabel: 'Samedi' },
    { key: 0, label: 'Dim', fullLabel: 'Dimanche' },
  ];

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Fonction pour scroller vers un tooltip
  const scrollToTooltip = (ref, offset = 100) => {
    if (ref.current && scrollViewRef.current) {
      ref.current.measureLayout(
        scrollViewRef.current,
        (x, y) => {
          scrollViewRef.current.scrollTo({
            y: y - offset, // Offset pour que le tooltip soit bien visible
            animated: true,
          });
        },
        () => {
          console.log('Erreur de mesure du layout');
        }
      );
    }
  };

  // Fonction pour charger les préférences
  const loadPreferences = async () => {
      try {
        const enabled = await AsyncStorage.getItem('notificationsEnabled');
        const severities = await AsyncStorage.getItem('selectedSeverities');
        const days = await AsyncStorage.getItem('selectedDays');
        const start = await AsyncStorage.getItem('startHour');
        const end = await AsyncStorage.getItem('endHour');

        if (enabled !== null) {
          setNotificationsEnabled(enabled === 'true');
        }
        if (severities !== null) {
          setSelectedSeverities(JSON.parse(severities));
        }
        if (days !== null) {
          setSelectedDays(JSON.parse(days));
        }
        if (start !== null) {
          setStartHour(parseInt(start));
        }
        if (end !== null) {
          setEndHour(parseInt(end));
        }

        // Charger la ville et le statut premium depuis Firestore
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Charger le statut premium
            setIsPremium(userData.isPremium || false);

            // Charger les villes (nouveau format tableau ou ancien format string)
            if (userData.cities && Array.isArray(userData.cities)) {
              setSelectedCities(userData.cities);
            } else if (userData.city) {
              // Migration de l'ancien format
              setSelectedCities([userData.city]);
            }
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };

  // Charger les préférences de notifications et la ville
  useEffect(() => {
    loadPreferences();
  }, [currentUser]);

  // Sauvegarder les préférences de notifications
  const saveNotificationPreferences = async (enabled, severities, days, start, end) => {
    try {
      await AsyncStorage.setItem('notificationsEnabled', enabled.toString());
      await AsyncStorage.setItem('selectedSeverities', JSON.stringify(severities));
      await AsyncStorage.setItem('selectedDays', JSON.stringify(days));
      await AsyncStorage.setItem('startHour', start.toString());
      await AsyncStorage.setItem('endHour', end.toString());

      // Sauvegarder également dans Firebase si l'utilisateur est connecté
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          notificationsEnabled: enabled,
          selectedSeverities: severities,
          selectedDays: days,
          startHour: start,
          endHour: end,
        });
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    }
  };

  // Gérer le changement de l'état des notifications
  const handleNotificationsToggle = async (value) => {
    if (value) {
      // Demander les permissions si on active les notifications
      const result = await requestNotificationPermissions();
      if (!result.success) {
        Alert.alert(
          'Permissions refusées',
          'Vous devez autoriser les notifications dans les réglages de votre téléphone pour recevoir des alertes.'
        );
        return;
      }
    }

    setNotificationsEnabled(value);
    await saveNotificationPreferences(value, selectedSeverities, selectedDays, startHour, endHour);
  };

  // Gérer le changement des niveaux de gravité
  const handleSeverityToggle = async (severity) => {
    let newSeverities;
    if (selectedSeverities.includes(severity)) {
      // Ne pas permettre de tout désélectionner
      if (selectedSeverities.length === 1) {
        Alert.alert('Erreur', 'Vous devez sélectionner au moins une gravité');
        return;
      }
      newSeverities = selectedSeverities.filter(s => s !== severity);
    } else {
      newSeverities = [...selectedSeverities, severity];
    }
    setSelectedSeverities(newSeverities);
    await saveNotificationPreferences(notificationsEnabled, newSeverities, selectedDays, startHour, endHour);
  };

  // Gérer le changement des jours
  const handleDayToggle = async (day) => {
    let newDays;
    if (selectedDays.includes(day)) {
      // Ne pas permettre de tout désélectionner
      if (selectedDays.length === 1) {
        Alert.alert('Erreur', 'Vous devez sélectionner au moins un jour');
        return;
      }
      newDays = selectedDays.filter(d => d !== day);
    } else {
      newDays = [...selectedDays, day];
    }
    setSelectedDays(newDays);
    await saveNotificationPreferences(notificationsEnabled, selectedSeverities, newDays, startHour, endHour);
  };

  // Gérer le changement de l'heure de début
  const handleStartHourChange = async (hour) => {
    setStartHour(hour);
    await saveNotificationPreferences(notificationsEnabled, selectedSeverities, selectedDays, hour, endHour);
  };

  // Gérer le changement de l'heure de fin
  const handleEndHourChange = async (hour) => {
    setEndHour(hour);
    await saveNotificationPreferences(notificationsEnabled, selectedSeverities, selectedDays, startHour, hour);
  };

  // Gérer le changement de ville
  const handleCityChange = async (city) => {
    try {
      let newCities;

      if (isPremium) {
        // Premium : permettre la sélection multiple
        if (selectedCities.includes(city)) {
          // Désélectionner si déjà sélectionné (mais garder au moins une ville)
          if (selectedCities.length > 1) {
            newCities = selectedCities.filter(c => c !== city);
          } else {
            Alert.alert('Information', 'Vous devez avoir au moins une ville sélectionnée');
            return;
          }
        } else {
          // Ajouter la ville
          newCities = [...selectedCities, city];
        }
      } else {
        // Non-premium : une seule ville à la fois
        if (selectedCities.includes(city)) {
          // Déjà sélectionné, ne rien faire
          return;
        } else {
          // Afficher un message pour inciter au premium si tentative de sélectionner les deux
          if (selectedCities.length > 0) {
            Alert.alert(
              'Lini Premium',
              'Avec Lini Premium, vous pouvez sélectionner plusieurs villes. Passez à Premium pour profiter de cette fonctionnalité !',
              [
                { text: 'Plus tard', style: 'cancel' },
                {
                  text: 'Voir Premium',
                  onPress: () => navigation.navigate('Premium')
                }
              ]
            );
          }
          newCities = [city];
        }
      }

      setSelectedCities(newCities);
      console.log('🏙️ Nouvelles villes sélectionnées:', newCities);

      // Sauvegarder dans Firestore
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          cities: newCities,
          city: newCities[0], // Pour rétro-compatibilité
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating city:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la ville');
    }
  };

  // TEMPORAIRE : Activer le premium pour le compte de développement
  const handleActivatePremiumDev = async () => {
    setLoading(true);
    const result = await activatePremiumForUser('quentinmichaud93460@hotmail.fr');
    setLoading(false);

    if (result.success) {
      Alert.alert('Succès', 'Premium activé de façon permanente ! Veuillez vous reconnecter pour voir les changements.', [
        { text: 'OK', onPress: () => {
          // Recharger les données de l'utilisateur
          loadPreferences();
        }}
      ]);
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d\'activer le premium');
    }
  };

  // TEMPORAIRE : Désactiver le premium (DEV ONLY)
  const handleDeactivatePremiumDev = async () => {
    if (!currentUser) {
      Alert.alert('Erreur', 'Utilisateur non connecté');
      return;
    }

    Alert.alert(
      'Désactiver Premium',
      'Voulez-vous désactiver le statut Premium pour ce compte ? Les villes seront limitées à une seule.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const userRef = doc(db, 'users', currentUser.uid);

              // Limiter à une seule ville (garder la première)
              const singleCity = selectedCities.length > 0 ? [selectedCities[0]] : ['Paris'];

              await updateDoc(userRef, {
                isPremium: false,
                premiumExpiresAt: null,
                cities: singleCity,
                city: singleCity[0],
                updatedAt: new Date().toISOString(),
              });

              setLoading(false);
              Alert.alert('Succès', `Premium désactivé ! Ville limitée à ${singleCity[0]}.`, [
                { text: 'OK', onPress: () => {
                  loadPreferences();
                }}
              ]);
            } catch (error) {
              setLoading(false);
              console.error('Erreur lors de la désactivation du premium:', error);
              Alert.alert('Erreur', 'Impossible de désactiver le premium');
            }
          },
        },
      ]
    );
  };

  // Rejouer le walkthrough
  const handleRestartWalkthrough = () => {
    Alert.alert(
      'Tutoriel',
      'Voulez-vous revoir le tutoriel de présentation de l\'application ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          onPress: async () => {
            await resetWalkthrough();
            Alert.alert(
              'Tutoriel activé',
              'Le tutoriel va maintenant s\'afficher sur les différentes pages de l\'application.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  // Gérer la déconnexion
  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await logout();
            setLoading(false);

            if (result.success) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } else {
              Alert.alert('Erreur', result.error || 'Erreur lors de la déconnexion');
            }
          },
        },
      ]
    );
  };

  // Gérer le changement de mot de passe
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (result.success) {
      Alert.alert('Succès', 'Votre mot de passe a été changé avec succès');
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors du changement de mot de passe');
    }
  };

  // Gérer la suppression du compte
  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Êtes-vous absolument sûr de vouloir supprimer votre compte ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            // Demander le mot de passe pour confirmation
            Alert.prompt(
              'Confirmation',
              'Entrez votre mot de passe pour confirmer la suppression',
              async (password) => {
                if (!password) {
                  Alert.alert('Erreur', 'Mot de passe requis');
                  return;
                }

                setLoading(true);
                const result = await deleteAccount(password);
                setLoading(false);

                if (result.success) {
                  Alert.alert(
                    'Compte supprimé',
                    'Votre compte a été supprimé avec succès',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                          });
                        },
                      },
                    ]
                  );
                } else {
                  Alert.alert('Erreur', result.error || 'Erreur lors de la suppression du compte');
                }
              },
              'secure-text'
            );
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Mesh Gradient Background */}
{/*       <View style={styles.meshGradientContainer} pointerEvents="none">
        <LinearGradient
          colors={['rgba(201, 242, 223, 0.3)', 'transparent']}
          style={[styles.meshGradient, { top: 0, left: 0 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(141, 228, 192, 0.25)']}
          style={[styles.meshGradient, { top: '30%', right: 0 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(93, 214, 160, 0.2)', 'transparent']}
          style={[styles.meshGradient, { bottom: '20%', left: '10%' }]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(140, 233, 246, 0.15)']}
          style={[styles.meshGradient, { bottom: 0, right: '5%' }]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
        />
      </View> */}

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
      {/* Titre de la page */}
      <View style={[styles.pageHeader, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.pageTitle, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
          Options
        </Text>
      </View>

      {/* Introduction */}
      <View style={[styles.section, { marginBottom: 0 }]} ref={introRef}>
        <WalkthroughTooltip
          stepId={WALKTHROUGH_STEPS.SETTINGS.INTRODUCTION}
          title="Paramètres de l'application"
          content="Personnalisez votre expérience : changez le thème, la taille du texte, configurez vos notifications et gérez votre compte. Toutes vos préférences sont sauvegardées automatiquement."
          placement="bottom"
          onShow={() => scrollToTooltip(introRef)}
        >
          <View style={styles.introContainer}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.iconActive} />
            <Text style={[styles.introText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Personnalisez votre application selon vos préférences
            </Text>
          </View>
        </WalkthroughTooltip>
      </View>

      <View style={styles.section}>
        <WalkthroughTooltip
          stepId={WALKTHROUGH_STEPS.SETTINGS.THEME_MODE}
          title="Changer le thème"
          content="Choisissez entre le mode clair, normal ou sombre selon votre préférence. Le thème s'applique immédiatement à toute l'application."
          placement="bottom"
          previousStepId={WALKTHROUGH_STEPS.SETTINGS.INTRODUCTION}
          onShow={() => scrollToTooltip(themeRef)}
        >
          <View style={styles.sectionTitleContainer} ref={themeRef}>
            <View style={styles.titleAccent} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Apparence
            </Text>
          </View>
        </WalkthroughTooltip>

        <View style={styles.modernThemeContainer}>
          {themeOptions.map((option) => {
            const isSelected = theme.name === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modernThemeCard,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.post,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => changeTheme(option.key)}
              >
                <View style={[
                  styles.modernThemeIconContainer,
                  {
                    backgroundColor: isSelected ? theme.colors.background : theme.colors.background,
                  }
                ]}>
                  <Ionicons
                    name={option.icon}
                    size={28}
                    color={isSelected ? theme.colors.iconActive : theme.colors.iconInactive}
                  />
                </View>
                <Text
                  style={[
                    styles.modernThemeLabel,
                    {
                      color: isSelected ? theme.colors.text : theme.colors.text,
                      fontSize: fontSize.sizes.body,
                    }
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <View style={styles.modernCheckmarkContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.iconActive}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Taille de police
          </Text>
        </View>

        <View style={styles.modernThemeContainer}>
          {fontSizeOptions.map((option) => {
            const isSelected = fontSize.name === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modernThemeCard,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.post,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => changeFontSize(option.key)}
              >
                <View style={[
                  styles.modernThemeIconContainer,
                  {
                    backgroundColor: isSelected ? theme.colors.background : theme.colors.background,
                  }
                ]}>
                  <Ionicons
                    name={option.icon}
                    size={option.iconSize}
                    color={isSelected ? theme.colors.iconActive : theme.colors.iconInactive}
                  />
                </View>
                <Text
                  style={[
                    styles.modernThemeLabel,
                    {
                      color: isSelected ? theme.colors.text : theme.colors.text,
                      fontSize: fontSize.sizes.body,
                    }
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <View style={styles.modernCheckmarkContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.iconActive}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Section Ville */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Ville
          </Text>
        </View>

        <View style={styles.modernThemeContainer}>
          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Paris') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Paris')}
          >
            <View style={[
              styles.modernThemeIconContainer,
              {
                backgroundColor: selectedCities.includes('Paris') ? theme.colors.background : theme.colors.background,
              }
            ]}>
              <Image
                source={require('../assets/paris.png')}
                style={[
                  styles.cityIcon,
                  {
                    opacity: selectedCities.includes('Paris') ? 1 : 0.5,
                  }
                ]}
                resizeMode="contain"
              />
            </View>
            <Text
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Paris') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Paris
            </Text>
            {selectedCities.includes('Paris') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Lyon') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Lyon')}
          >
            <View style={[
              styles.modernThemeIconContainer,
              {
                backgroundColor: selectedCities.includes('Lyon') ? theme.colors.background : theme.colors.background,
              }
            ]}>
              <Image
                source={require('../assets/lyon.png')}
                style={[
                  styles.cityIcon,
                  {
                    opacity: selectedCities.includes('Lyon') ? 1 : 0.5,
                  }
                ]}
                resizeMode="contain"
              />
            </View>
            <Text
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Lyon') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Lyon
            </Text>
            {selectedCities.includes('Lyon') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <View
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: theme.colors.post,
                borderColor: theme.colors.border,
                opacity: 0.6,
              }
            ]}
          >
            <View style={[
              styles.modernThemeIconContainer,
              {
                backgroundColor: theme.colors.background,
              }
            ]}>
              <Ionicons
                name="add-circle-outline"
                size={32}
                color={theme.colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.modernThemeLabel,
                {
                  color: theme.colors.textSecondary,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Bientôt
            </Text>
          </View>
        </View>
      </View>

      {/* Section Notifications */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <WalkthroughTooltip
            stepId={WALKTHROUGH_STEPS.SETTINGS.NOTIFICATIONS}
            title="Notifications"
            content="Recevez des alertes en temps réel pour les incidents sur vos lignes préférées. Personnalisez les gravités, jours et horaires."
            placement="top"
            previousStepId={WALKTHROUGH_STEPS.SETTINGS.THEME_MODE}
            onShow={() => scrollToTooltip(notificationsRef, 300)}
          >
            <View ref={notificationsRef}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Notifications
              </Text>
            </View>
          </WalkthroughTooltip>
        </View>

        {/* Activer les notifications */}
        <View style={[styles.notificationOption, { backgroundColor: notificationsEnabled ? theme.colors.primary : theme.colors.post, borderColor: '#E5E5E5' }]}>
          <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
            <Ionicons name="notifications" size={22} color="#fff" />
          </View>
          <View style={styles.notificationDivider} />
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Notifications pour votre ligne
            </Text>
            <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Recevez des alertes pour les incidents
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: theme.colors.border, true: theme.colors.iconActive }}
            thumbColor="#fff"
            style={{ alignSelf: 'center' }}
          />
        </View>

        {/* Sélection des gravités */}
        {notificationsEnabled && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Gravités concernées
            </Text>
            <View style={styles.severityCardsContainer}>
              {severityOptions.map((option) => {
                const isSelected = selectedSeverities.includes(option.key);
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.severityCard,
                      {
                        backgroundColor: isSelected ? option.color : theme.colors.post,
                        borderColor: theme.colors.border,
                      }
                    ]}
                    onPress={() => handleSeverityToggle(option.key)}
                  >
                    <View style={[
                      styles.severityIconContainer,
                      {
                        backgroundColor: isSelected ? theme.colors.background : theme.colors.primary,
                      }
                    ]}>
                      <Ionicons
                        name={option.icon}
                        size={24}
                        color={isSelected ? option.color : theme.colors.iconInactive}
                      />
                    </View>
                    <Text
                      style={[
                        styles.severityCardLabel,
                        {
                          color: isSelected ? '#000' : theme.colors.text,
                          fontSize: fontSize.sizes.small,
                        }
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.modernCheckmarkContainer}>
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#000"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Sélection des jours */}
        {notificationsEnabled && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Jours actifs
            </Text>
            <View style={styles.daysContainer}>
              {daysOfWeek.map((day) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.post,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        borderWidth: 1,
                      }
                    ]}
                    onPress={() => handleDayToggle(day.key)}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        {
                          color: isSelected ? theme.colors.text : theme.colors.text,
                          fontSize: fontSize.sizes.small,
                        }
                      ]}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Plage horaire */}
        {notificationsEnabled && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Plage horaire
            </Text>
            <Text style={[styles.helperText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 12 }]}>
              Vous pouvez définir une plage qui traverse minuit (ex: 23h-2h)
            </Text>

            {/* Affichage de la plage sélectionnée */}
            <View style={[styles.timeRangeDisplay, { backgroundColor: theme.colors.primary, borderColor: theme.colors.border }]}>
              <View style={styles.timeRangeIconContainer}>
                <View style={[styles.timeIconCircle, { backgroundColor: theme.colors.background }]}>
                  <Ionicons name="time-outline" size={28} color={theme.colors.iconActive} />
                </View>
              </View>
              <View style={styles.timeRangeTextContainer}>
                <Text style={[styles.timeRangeLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Notifications actives de
                </Text>
                <Text style={[styles.timeRangeValue, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
                  {startHour.toString().padStart(2, '0')}h - {endHour.toString().padStart(2, '0')}h
                </Text>
                {startHour > endHour && (
                  <Text style={[styles.timeRangeLabel, { color: theme.colors.iconActive, fontSize: fontSize.sizes.small, fontStyle: 'italic', marginTop: 2 }]}>
                    ⏰ Traverse minuit
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.timeRangeContainer}>
              {/* Heure de début */}
              <View style={styles.timeSelector}>
                <Text style={[styles.timeLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  Début
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.hourScroll}
                  contentContainerStyle={styles.hourScrollContent}
                >
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={`start-${hour}`}
                      style={[
                        styles.hourChip,
                        {
                          backgroundColor: startHour === hour ? theme.colors.primary : theme.colors.post,
                          borderColor: startHour === hour ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                      onPress={() => handleStartHourChange(hour)}
                    >
                      <Text
                        style={[
                          styles.hourText,
                          {
                            color: startHour === hour ? theme.colors.text : theme.colors.text,
                            fontSize: fontSize.sizes.small,
                          }
                        ]}
                      >
                        {hour.toString().padStart(2, '0')}h
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Heure de fin */}
              <View style={styles.timeSelector}>
                <Text style={[styles.timeLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  Fin
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.hourScroll}
                  contentContainerStyle={styles.hourScrollContent}
                >
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={`end-${hour}`}
                      style={[
                        styles.hourChip,
                        {
                          backgroundColor: endHour === hour ? theme.colors.primary : theme.colors.post,
                          borderColor: endHour === hour ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                      onPress={() => handleEndHourChange(hour)}
                    >
                      <Text
                        style={[
                          styles.hourText,
                          {
                            color: endHour === hour ? theme.colors.text : theme.colors.text,
                            fontSize: fontSize.sizes.small,
                          }
                        ]}
                      >
                        {hour.toString().padStart(2, '0')}h
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Section Compte */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Compte
          </Text>
        </View>

        {/* Lini Premium */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.iconActive, borderColor: '#E5E5E5' }
          ]}
          onPress={() => navigation.navigate('Premium')}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
            <Ionicons name="diamond" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: '#fff', fontSize: fontSize.sizes.body }]}>
              Lini Premium
            </Text>
            <Text style={[styles.notificationSubLabel, { color: '#fff', opacity: 0.9, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              Profitez de Lini sans publicité pour 0,99€/mois
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Changer le mot de passe */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={() => setPasswordModalVisible(true)}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
            <Ionicons name="key-outline" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Changer le mot de passe
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>

        {/* Déconnexion */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={handleLogout}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Se déconnecter
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>

        {/* Supprimer le compte */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#DC3545' }
          ]}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: '#DC3545' }]}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: '#DC3545', fontSize: fontSize.sizes.body }]}>
              Supprimer le compte
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#DC3545" />
        </TouchableOpacity>
      </View>

      {/* Section Aide */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Aide
          </Text>
        </View>

        {/* TEMPORAIRE - Bouton pour activer le premium (DEV ONLY) */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.iconActive, borderColor: '#E5E5E5' }
          ]}
          onPress={handleActivatePremiumDev}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
            <Ionicons name="diamond" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: '#fff', fontSize: fontSize.sizes.body }]}>
              [DEV] Activer Premium
            </Text>
            <Text style={[styles.notificationSubLabel, { color: '#fff', opacity: 0.9, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              Activer le premium permanent pour ce compte
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        {/* TEMPORAIRE - Bouton pour désactiver le premium (DEV ONLY) */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: '#DC3545', borderColor: '#DC3545' }
          ]}
          onPress={handleDeactivatePremiumDev}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
            <Ionicons name="diamond-outline" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: '#fff', fontSize: fontSize.sizes.body }]}>
              [DEV] Désactiver Premium
            </Text>
            <Text style={[styles.notificationSubLabel, { color: '#fff', opacity: 0.9, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              Retirer le statut premium pour tester
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={handleRestartWalkthrough}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Rejouer le tutoriel
            </Text>
            <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              Découvrez à nouveau comment utiliser l'application
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Politique de confidentialité
            </Text>
            <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              En savoir plus sur la protection de vos données
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>
      </View>

      {/* Modal de changement de mot de passe */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Changer le mot de passe
              </Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Mot de passe actuel
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.colors.navbar,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Entrez votre mot de passe actuel"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Nouveau mot de passe
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.colors.navbar,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Confirmer le nouveau mot de passe
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.colors.navbar,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Retapez votre nouveau mot de passe"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.iconActive }]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { fontSize: fontSize.sizes.body }]}>
                    Changer le mot de passe
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  meshGradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  meshGradient: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  pageHeader: {
    height: 120,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pageTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  section: {
    padding: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleAccent: {
    width: 4,
    height: 24,
    backgroundColor: '#C9F2DF',
    borderRadius: 2,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  themeContainer: {
    gap: 12,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  themeLabel: {
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 16,
    flex: 1,
  },
  checkmark: {
    marginLeft: 'auto',
  },
  modernThemeContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modernThemeCard: {
    width: '31%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    minHeight: 120,
    justifyContent: 'center',
  },
  modernThemeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cityIcon: {
    width: 50,
    height: 50,
  },
  modernThemeLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  modernCheckmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  notificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDivider: {
    width: 1,
    height: '65%',
    backgroundColor: '#999999',
    opacity: 0.5,
  },
  notificationContent: {
    flex: 1,
  },
  notificationLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 2,
  },
  notificationSubLabel: {
    fontFamily: 'Fredoka_400Regular',
  },
  severityContainer: {
    marginTop: 8,
  },
  filterLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 12,
  },
  helperText: {
    fontFamily: 'Fredoka_400Regular',
    fontStyle: 'italic',
  },
  severityCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  severityCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    minHeight: 100,
    justifyContent: 'center',
  },
  severityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  severityCardLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  severityOptions: {
    gap: 12,
  },
  severityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  severityLabel: {
    fontFamily: 'Fredoka_500Medium',
  },
  severityCheckmark: {
    marginLeft: 8,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'start',
  },
  dayChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  dayLabel: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  timeRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeRangeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeRangeTextContainer: {
    flex: 1,
    gap: 4,
  },
  timeRangeLabel: {
    fontFamily: 'Fredoka_400Regular',
  },
  timeRangeValue: {
    fontFamily: 'Fredoka_700Bold',
  },
  timeRangeContainer: {
    gap: 16,
  },
  timeSelector: {
    gap: 8,
  },
  timeLabel: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  hourScroll: {
    maxHeight: 50,
  },
  hourScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  hourChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hourText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  accountIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountDivider: {
    width: 1,
    height: '65%',
    backgroundColor: '#999999',
    opacity: 0.5,
  },
  accountContent: {
    flex: 1,
  },
  accountLabel: {
    fontFamily: 'Fredoka_500Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  modalBody: {
    gap: 12,
  },
  inputLabel: {
    fontFamily: 'Fredoka_500Medium',
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontFamily: 'Fredoka_400Regular',
    marginBottom: 8,
  },
  modalButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
  introContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  introText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
    flex: 1,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '../context/ThemeContext';
import { signUp, signInWithApple, isAppleAuthAvailable } from '../services/authService';
import { lignes } from '../data/lignes';
import { getStationsByPreferredLines } from '../data/stations';

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

export default function OnboardingScreen({ navigation, route }) {
  const { theme, fontSize } = useTheme();
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Récupérer les paramètres de navigation
  const mode = route?.params?.mode || 'signup'; // 'signup' ou 'complete'
  const isAppleAuth = route?.params?.appleAuth || false;
  const initialUserData = route?.params?.userData || {};

  const [formData, setFormData] = useState({
    firstName: initialUserData.firstName || '',
    lastName: initialUserData.lastName || '',
    email: initialUserData.email || '',
    password: '',
    confirmPassword: '',
    photoUri: initialUserData.photoURL || null,
  });

  // États pour les lignes et stations préférées
  const [selectedCity, setSelectedCity] = useState('Paris');
  const [selectedLines, setSelectedLines] = useState([]);
  const [selectedStations, setSelectedStations] = useState([]);
  const [availableStations, setAvailableStations] = useState([]);
  const [stationSearchQuery, setStationSearchQuery] = useState('');

  // États pour afficher/masquer les mots de passe
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Refs pour le scroll
  const scrollViewRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Fonction pour scroller vers la zone de recherche
  const scrollToSearchContainer = () => {
    if (searchContainerRef.current && scrollViewRef.current) {
      searchContainerRef.current.measureLayout(
        scrollViewRef.current,
        (x, y) => {
          scrollViewRef.current.scrollTo({ y: y - 100, animated: true });
        },
        () => {}
      );
    }
  };

  // Vérifier la disponibilité d'Apple Auth
  useEffect(() => {
    checkAppleAuthAvailability();
  }, []);

  // Réinitialiser les sélections quand la ville change
  useEffect(() => {
    setSelectedLines([]);
    setSelectedStations([]);
    setAvailableStations([]);
  }, [selectedCity]);

  // Mettre à jour les stations disponibles quand les lignes préférées changent
  useEffect(() => {
    if (selectedLines.length > 0) {
      const stations = getStationsByPreferredLines(selectedLines);
      setAvailableStations(stations);
    } else {
      setAvailableStations([]);
    }
  }, [selectedLines]);

  const checkAppleAuthAvailability = async () => {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  };

  // Sélectionner une photo de profil
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission requise', 'Vous devez autoriser l\'accès à vos photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setFormData({ ...formData, photoUri: result.assets[0].uri });
    }
  };

  // Validation du formulaire
  const validateForm = () => {
    if (!formData.firstName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre prénom');
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom de famille');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return false;
    }
    if (formData.password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  // Toggle une ligne
  const toggleLine = (lineValue) => {
    if (selectedLines.includes(lineValue)) {
      setSelectedLines(selectedLines.filter(l => l !== lineValue));
    } else {
      setSelectedLines([...selectedLines, lineValue]);
    }
  };

  // Toggle sélection de station
  const toggleStation = (station) => {
    if (selectedStations.includes(station)) {
      setSelectedStations(selectedStations.filter(s => s !== station));
    } else {
      setSelectedStations([...selectedStations, station]);
    }
  };

  // Classifier les lignes par catégorie
  const categorizeLines = () => {
    // Filtrer les lignes en fonction de la ville sélectionnée
    const cityLines = lignes.filter(l => l.city === selectedCity);

    const categories = {
      'Métro': cityLines.filter(l => l.label.startsWith('Métro ')),
      'RER': cityLines.filter(l => l.label.startsWith('RER ')),
      'Tram': cityLines.filter(l => l.label.startsWith('Tram ')),
      'Transilien': cityLines.filter(l => l.label.startsWith('Ligne ')),
    };
    return categories;
  };

  const categories = categorizeLines();

  // Soumettre le formulaire
  const handleSignUp = async () => {
    // Mode "complete" : on n'a besoin que des préférences
    if (mode === 'complete') {
      if (selectedLines.length === 0 && selectedStations.length === 0) {
        Alert.alert('Information manquante', 'Veuillez sélectionner au moins une ligne ou une station préférée');
        return;
      }

      setLoading(true);
      // Importer les fonctions nécessaires
      const { getCurrentUser } = await import('../services/authService');
      const { updatePreferredLines, updatePreferredStations } = await import('../services/authService');

      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('Erreur', 'Utilisateur non connecté');
        setLoading(false);
        return;
      }

      // Mettre à jour les préférences
      const linesResult = await updatePreferredLines(currentUser.uid, selectedLines);
      const stationsResult = await updatePreferredStations(currentUser.uid, selectedStations);
      setLoading(false);

      if (linesResult.success && stationsResult.success) {
        Alert.alert('Profil complété !', 'Votre profil a été complété avec succès !', [
          { text: 'OK', onPress: () => navigation.replace('Main') },
        ]);
      } else {
        Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour de vos préférences');
      }
      return;
    }

    // Mode "signup" : création de compte classique
    if (!validateForm()) return;

    setLoading(true);
    // Ajouter les préférences et la ville au formData
    const dataToSubmit = {
      ...formData,
      preferredLines: selectedLines,
      preferredStations: selectedStations,
      city: selectedCity, // Une seule ville à l'onboarding
    };
    const result = await signUp(dataToSubmit);
    setLoading(false);

    if (result.success) {
      // Vérifier si l'utilisateur voulait une photo mais qu'elle n'a pas été uploadée
      const wantedPhoto = formData.photoUri !== null;
      const hasPhoto = result.user?.photoURL !== null;

      if (wantedPhoto && !hasPhoto) {
        Alert.alert(
          'Compte créé !',
          'Votre compte a été créé avec succès.\n\nNote : La photo de profil n\'a pas pu être uploadée. Pour activer les photos, configurez Firebase Storage (voir TROUBLESHOOTING_STORAGE.md)',
          [{ text: 'OK', onPress: () => navigation.replace('Main') }]
        );
      } else {
        Alert.alert('Succès !', 'Votre compte a été créé avec succès !', [
          { text: 'OK', onPress: () => navigation.replace('Main') },
        ]);
      }
    } else {
      Alert.alert('Erreur', result.error || 'Une erreur est survenue');
    }
  };

  // Connexion avec Apple
  const handleAppleSignIn = async () => {
    setLoading(true);
    const result = await signInWithApple();
    setLoading(false);

    if (result.success) {
      navigation.replace('Main');
    } else if (!result.canceled) {
      Alert.alert('Erreur', result.error || 'Erreur lors de la connexion avec Apple');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {/* Cercles décoratifs en arrière-plan */}
{/*         <View style={styles.backgroundDecoration}>
          <View style={[styles.circle1, { backgroundColor: theme.colors.iconActive, opacity: 0.08 }]} />
          <View style={[styles.circle2, { backgroundColor: theme.colors.iconActive, opacity: 0.08 }]} />
          <View style={[styles.circle3, { backgroundColor: theme.colors.primary, opacity: 0.06 }]} />
        </View> */}

        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={{ padding: 20, paddingTop: 40, paddingBottom: 400 }}
          keyboardShouldPersistTaps="handled"
        >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <LiniLogo size={250} />
        </View>

        <Text style={[styles.title, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
          {mode === 'complete' ? 'Compléter votre profil' : 'Créer un compte'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
          {mode === 'complete' ? 'Définissez vos lignes et stations préférées' : 'Rejoignez Lini dès aujourd\'hui'}
        </Text>

        {/* Photo de profil (masqué en mode complete) */}
        {mode !== 'complete' && (
          <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
          {formData.photoUri ? (
            <Image source={{ uri: formData.photoUri }} style={styles.profilePhoto} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: theme.colors.navbar }]}>
              <Ionicons name="camera" size={40} color={theme.colors.iconInactive} />
            </View>
          )}
          <Text style={[styles.photoText, { color: theme.colors.iconActive, fontSize: fontSize.sizes.small }]}>
            {formData.photoUri ? 'Changer la photo' : 'Ajouter une photo'}
          </Text>
        </TouchableOpacity>
        )}

        {/* Champs masqués en mode complete */}
        {mode !== 'complete' && (
          <>
            {/* Prénom */}
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
              <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
                <Ionicons name="person-outline" size={22} color="#fff" />
              </View>
              <View style={[styles.fieldDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Prénom
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    {
                      color: theme.colors.text,
                      fontSize: fontSize.sizes.body,
                    },
                  ]}
                  placeholder="Votre prénom"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.firstName}
                  onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                />
              </View>
            </View>

            {/* Nom de famille */}
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
              <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
                <Ionicons name="person-circle-outline" size={22} color="#fff" />
              </View>
              <View style={[styles.fieldDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Nom de famille
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    {
                      color: theme.colors.text,
                      fontSize: fontSize.sizes.body,
                    },
                  ]}
                  placeholder="Votre nom"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.lastName}
                  onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                />
              </View>
            </View>

            {/* Email */}
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
              <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
                <Ionicons name="mail-outline" size={22} color="#fff" />
              </View>
              <View style={[styles.fieldDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Adresse email
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    {
                      color: theme.colors.text,
                      fontSize: fontSize.sizes.body,
                    },
                  ]}
                  placeholder="votre@email.com"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                />
              </View>
            </View>

            {/* Mot de passe */}
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
              <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
                <Ionicons name="lock-closed-outline" size={22} color="#fff" />
              </View>
              <View style={[styles.fieldDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Mot de passe
                </Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      styles.passwordInput,
                      {
                        color: theme.colors.text,
                        fontSize: fontSize.sizes.body,
                      },
                    ]}
                    placeholder="Minimum 6 caractères"
                    placeholderTextColor={theme.colors.textSecondary}
                    secureTextEntry={!showPassword}
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
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
              </View>
            </View>

            {/* Confirmation mot de passe */}
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
              <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
              </View>
              <View style={[styles.fieldDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Confirmer le mot de passe
                </Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      styles.passwordInput,
                      {
                        color: theme.colors.text,
                        fontSize: fontSize.sizes.body,
                      },
                    ]}
                    placeholder="Retapez votre mot de passe"
                    placeholderTextColor={theme.colors.textSecondary}
                    secureTextEntry={!showConfirmPassword}
                    value={formData.confirmPassword}
                    onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                      size={22}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Sélection de la ville */}
        <View style={styles.preferencesSection}>
          <View style={styles.sectionTitleContainer}>
            <View style={[styles.titleAccent, { backgroundColor: theme.colors.iconActive }]} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Ville
            </Text>
          </View>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
            Sélectionnez votre ville pour voir les informations pertinentes
          </Text>

          <View style={styles.cityRow}>
            <TouchableOpacity
              style={[
                styles.cityCard,
                {
                  backgroundColor: selectedCity === 'Paris' ? theme.colors.primary : theme.colors.post,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={() => setSelectedCity('Paris')}
            >
              <View style={[
                styles.cityIconContainer,
                {
                  backgroundColor: selectedCity === 'Paris' ? theme.colors.background : theme.colors.background,
                }
              ]}>
                <Image
                  source={require('../assets/paris.png')}
                  style={[
                    styles.cityIcon,
                    {
                      opacity: selectedCity === 'Paris' ? 1 : 0.5,
                    }
                  ]}
                  resizeMode="contain"
                />
              </View>
              <Text
                style={[
                  styles.cityLabel,
                  {
                    color: selectedCity === 'Paris' ? theme.colors.text : theme.colors.text,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
              >
                Paris
              </Text>
              {selectedCity === 'Paris' && (
                <View style={styles.cityCheckmarkContainer}>
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
                styles.cityCard,
                {
                  backgroundColor: selectedCity === 'Lyon' ? theme.colors.primary : theme.colors.post,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={() => setSelectedCity('Lyon')}
            >
              <View style={[
                styles.cityIconContainer,
                {
                  backgroundColor: selectedCity === 'Lyon' ? theme.colors.background : theme.colors.background,
                }
              ]}>
                <Image
                  source={require('../assets/lyon.png')}
                  style={[
                    styles.cityIcon,
                    {
                      opacity: selectedCity === 'Lyon' ? 1 : 0.5,
                    }
                  ]}
                  resizeMode="contain"
                />
              </View>
              <Text
                style={[
                  styles.cityLabel,
                  {
                    color: selectedCity === 'Lyon' ? theme.colors.text : theme.colors.text,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
              >
                Lyon
              </Text>
              {selectedCity === 'Lyon' && (
                <View style={styles.cityCheckmarkContainer}>
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
                styles.cityCard,
                {
                  backgroundColor: theme.colors.post,
                  borderColor: theme.colors.border,
                  opacity: 0.6,
                }
              ]}
            >
              <View style={[
                styles.cityIconContainer,
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
                  styles.cityLabel,
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

          {/* Message Premium pour plusieurs villes */}
          <View style={[styles.premiumInfoBox, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
            <Ionicons name="diamond" size={20} color="#FFD700" />
            <Text style={[styles.premiumInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Pour sélectionner plusieurs villes, passez à Lini Premium après la création de votre compte
            </Text>
          </View>
        </View>

        {/* Lignes préférées */}
        <View style={styles.preferencesSection}>
          <View style={styles.sectionTitleContainer}>
            <View style={[styles.titleAccent, { backgroundColor: theme.colors.iconActive }]} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Lignes préférées
            </Text>
          </View>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
            Sélectionnez vos lignes de transport habituelles
          </Text>

          {/* Sélecteur de lignes par catégorie */}
          {Object.entries(categories)
            .filter(([_, categoryLines]) => categoryLines.length > 0)
            .map(([categoryName, categoryLines]) => (
            <View key={categoryName} style={styles.categoryContainer}>
              <Text style={[styles.categoryTitle, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                {categoryName}
              </Text>
              <View style={styles.badgesContainer}>
                {categoryLines.map((ligne) => {
                  const isSelected = selectedLines.includes(ligne.value);
                  return (
                    <TouchableOpacity
                      key={ligne.value}
                      style={[
                        styles.badge,
                        {
                          backgroundColor: ligne.backgroundColor,
                          opacity: isSelected ? 1 : 0.5,
                        }
                      ]}
                      onPress={() => toggleLine(ligne.value)}
                    >
                      <Text style={[styles.badgeText, { color: ligne.color }]}>
                        {ligne.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={ligne.color} style={styles.badgeCheck} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Stations / Gares préférées */}
        {selectedLines.length > 0 && (
          <View style={styles.preferencesSection}>
            <View style={styles.sectionTitleContainer}>
              <View style={[styles.titleAccent, { backgroundColor: theme.colors.iconActive }]} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Arrêts préférés
              </Text>
            </View>
            <Text style={[styles.helperText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 15 }]}>
              Recherchez et sélectionnez vos stations habituelles
            </Text>

            {/* Affichage des stations sélectionnées */}
            {selectedStations.length > 0 && (
              <View style={styles.selectedStationsContainer}>
                {selectedStations.map((station) => (
                  <View
                    key={station}
                    style={[
                      styles.selectedStationChip,
                      { backgroundColor: theme.colors.primary }
                    ]}
                  >
                    <Text style={[
                      styles.selectedStationText,
                      {
                        fontSize: fontSize.sizes.small,
                        color: theme.name === 'dark' ? '#FFFFFF' : '#000000'
                      }
                    ]}>
                      {station}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleStation(station)}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={theme.name === 'dark' ? '#FFFFFF' : '#000000'}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Barre de recherche */}
            <View style={styles.searchContainer} ref={searchContainerRef}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.colors.navbar,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Rechercher une station..."
                placeholderTextColor={theme.colors.textSecondary}
                value={stationSearchQuery}
                onChangeText={setStationSearchQuery}
                onFocus={scrollToSearchContainer}
              />
              {stationSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setStationSearchQuery('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Résultats filtrés */}
            <View style={styles.stationsContainer}>
              {availableStations
                .filter(station =>
                  station.toLowerCase().includes(stationSearchQuery.toLowerCase())
                )
                .slice(0, 30) // Limiter à 30 résultats pour l'onboarding
                .map((station) => {
                  const isSelected = selectedStations.includes(station);
                  return (
                    <TouchableOpacity
                      key={station}
                      style={[
                        styles.stationChip,
                        {
                          backgroundColor: isSelected ? theme.colors.iconActive : theme.colors.navbar,
                          borderColor: theme.colors.iconActive,
                          opacity: isSelected ? 1 : 0.7,
                        }
                      ]}
                      onPress={() => toggleStation(station)}
                    >
                      <Text style={[
                        styles.stationText,
                        {
                          color: isSelected ? '#fff' : theme.colors.text,
                          fontSize: fontSize.sizes.small
                        }
                      ]}>
                        {station}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color="#fff" style={styles.stationCheck} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>

            {/* Message si aucun résultat */}
            {availableStations.filter(station =>
              station.toLowerCase().includes(stationSearchQuery.toLowerCase())
            ).length === 0 && stationSearchQuery.length > 0 && (
              <View style={[styles.infoBox, { backgroundColor: theme.colors.navbar, borderColor: theme.colors.border }]}>
                <Ionicons name="information-circle" size={20} color={theme.colors.iconActive} />
                <Text style={[styles.infoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Aucune station trouvée pour "{stationSearchQuery}"
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Boutons d'inscription côte à côte */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[
              mode === 'complete' ? styles.buttonFull : styles.buttonHalf,
              { backgroundColor: theme.colors.iconActive }
            ]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, { fontSize: fontSize.sizes.body }]}>
                {mode === 'complete' ? 'Compléter le profil' : 'S\'inscrire'}
              </Text>
            )}
          </TouchableOpacity>

          {mode !== 'complete' && appleAuthAvailable && (
            <TouchableOpacity
              style={[
                styles.buttonHalf,
                styles.appleButtonCustom,
                { backgroundColor: theme.name === 'dark' ? '#FFFFFF' : '#000000' }
              ]}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              <Ionicons
                name="logo-apple"
                size={20}
                color={theme.name === 'dark' ? '#000000' : '#FFFFFF'}
                style={styles.appleIcon}
              />
              <Text style={[
                styles.buttonText,
                {
                  fontSize: fontSize.sizes.body,
                  color: theme.name === 'dark' ? '#000000' : '#FFFFFF'
                }
              ]}>
                Apple
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Lien vers connexion (masqué en mode complete) */}
        {mode !== 'complete' && (
          <TouchableOpacity
            style={styles.linkContainer}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.linkText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              Vous avez déjà un compte ?{' '}
              <Text style={{ color: theme.colors.iconActive, fontFamily: 'Fredoka_600SemiBold' }}>
                Se connecter
              </Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundDecoration: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    top: -150,
    right: -150,
  },
  circle2: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    bottom: -150,
    left: -150,
  },
  circle3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: '40%',
    right: -50,
  },
  logoContainer: {
    alignSelf: 'center',
    marginBottom: -80,
    borderRadius: 16,
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    marginBottom: 30,
    textAlign: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontFamily: 'Fredoka_500Medium',
    marginTop: 10,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Fredoka_500Medium',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontFamily: 'Fredoka_400Regular',
  },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldDivider: {
    width: 1,
    height: '65%',
    backgroundColor: '#999999',
    opacity: 0.5,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: 'Fredoka_400Regular',
    marginBottom: 4,
  },
  fieldInput: {
    fontFamily: 'Fredoka_500Medium',
    padding: 0,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  helperText: {
    fontFamily: 'Fredoka_400Regular',
    marginTop: 5,
    fontStyle: 'italic',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  buttonHalf: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonFull: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButtonCustom: {
    backgroundColor: '#000',
  },
  appleIcon: {
    marginRight: 6,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
  linkContainer: {
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 40,
  },
  linkText: {
    fontFamily: 'Fredoka_400Regular',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 15,
    fontFamily: 'Fredoka_400Regular',
  },
  preferencesSection: {
    marginBottom: 30,
    marginTop: 10,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleAccent: {
    width: 4,
    height: 24,
    backgroundColor: '#C9F2DF',
    borderRadius: 2,
    marginRight: 12,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  categoryContainer: {
    marginBottom: 20,
    marginTop: 15,
  },
  categoryTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 10,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 4,
    minWidth: 90,
  },
  badgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  badgeCheck: {
    marginLeft: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 15,
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    paddingLeft: 40,
    fontFamily: 'Fredoka_400Regular',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
  },
  stationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  stationText: {
    fontFamily: 'Fredoka_500Medium',
  },
  stationCheck: {
    marginLeft: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
  },
  infoText: {
    fontFamily: 'Fredoka_400Regular',
    flex: 1,
  },
  selectedStationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  selectedStationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  selectedStationText: {
    fontFamily: 'Fredoka_500Medium',
  },
  selectedCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCountText: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#fff',
  },
  cityRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 15,
    justifyContent: 'space-between',
  },
  cityCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  cityIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cityIcon: {
    width: 50,
    height: 50,
  },
  cityLabel: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  cityCheckmarkContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  premiumInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 15,
  },
  premiumInfoText: {
    fontFamily: 'Fredoka_400Regular',
    flex: 1,
    lineHeight: 20,
  },
});

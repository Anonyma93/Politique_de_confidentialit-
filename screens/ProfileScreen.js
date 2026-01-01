import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useWalkthrough, WALKTHROUGH_STEPS } from '../context/WalkthroughContext';
import WalkthroughTooltip from '../components/WalkthroughTooltip';
import { getCurrentUser, getUserData, updateUserProfile, updatePreferredLines, updatePreferredStations, updateProfilePhoto } from '../services/authService';
import { lignes } from '../data/lignes';
import { getStationsByPreferredLines } from '../data/stations';
import PremiumBadge from '../components/PremiumBadge';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

// Grades et leurs seuils
const GRADES_HIERARCHY = [
  { name: 'Guide suprême', minScore: 4.01, emoji: '👑', color: '#FFD700' },
  { name: 'Légende Métropolitaine', minScore: 3.01, emoji: '🏆', color: '#E5E4E2' },
  { name: 'Ministre du transport', minScore: 2.51, emoji: '🎖️', color: '#CD7F32' },
  { name: 'Sauveur de ligne', minScore: 2.11, emoji: '🦸', color: '#4CAF50' },
  { name: 'Dompteur de Navigo', minScore: 1.81, emoji: '🎯', color: '#2196F3' },
  { name: 'Pro du Strapontin', minScore: 1.51, emoji: '⭐', color: '#9C27B0' },
  { name: 'Inspecteur Réseau', minScore: 1.21, emoji: '🔍', color: '#FF9800' },
  { name: 'Contrôleur', minScore: 0.91, emoji: '🎫', color: '#795548' },
  { name: 'Chef de Quai', minScore: 0.61, emoji: '👷', color: '#607D8B' },
  { name: 'Agent de Bord', minScore: 0.31, emoji: '👔', color: '#9E9E9E' },
  { name: 'Touriste', minScore: 0, emoji: '🎒', color: '#BDBDBD' },
];

// Composant bouton animé
const AnimatedButton = ({ children, onPress, disabled, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Composant badge de ligne animé
const AnimatedLineBadge = ({ ligne, isSelected, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0.5)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isSelected ? 1 : 0.5,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: ligne.backgroundColor,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <Text style={[styles.badgeText, { color: ligne.color }]}>
          {ligne.label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={16} color={ligne.color} style={styles.badgeCheck} />
        )}
      </Animated.View>
    </Pressable>
  );
};

export default function ProfileScreen() {
  const { theme, fontSize } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [editMode, setEditMode] = useState({
    firstName: false,
    lastName: false,
    email: false,
  });

  // États pour les champs éditables
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  // État pour les lignes préférées
  const [selectedLines, setSelectedLines] = useState([]);
  const [editingLines, setEditingLines] = useState(false);
  const [tempSelectedLines, setTempSelectedLines] = useState([]);

  // État pour les stations préférées
  const [selectedStations, setSelectedStations] = useState([]);
  const [editingStations, setEditingStations] = useState(false);
  const [tempSelectedStations, setTempSelectedStations] = useState([]);
  const [availableStations, setAvailableStations] = useState([]);
  const [stationSearchQuery, setStationSearchQuery] = useState('');

  // Ref pour le ScrollView
  const scrollViewRef = useRef(null);

  // État pour le modal de pyramide des rankings
  const [showRankingModal, setShowRankingModal] = useState(false);

  // État pour l'upload de la photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Charger les données utilisateur à chaque fois que l'écran est affiché
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  // Scroller vers le haut quand on arrive sur la page
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  // Mettre à jour les stations disponibles quand les lignes préférées changent
  useEffect(() => {
    if (selectedLines.length > 0) {
      const stations = getStationsByPreferredLines(selectedLines);
      setAvailableStations(stations);
    } else {
      setAvailableStations([]);
    }
  }, [selectedLines]);

  const loadUserData = async () => {
    setLoading(true);
    const user = getCurrentUser();
    if (user) {
      const result = await getUserData(user.uid);
      if (result.success) {
        setUserData(result.data);
        setFormData({
          firstName: result.data.firstName || '',
          lastName: result.data.lastName || '',
          email: result.data.email || '',
        });
        // Charger les lignes préférées (si c'est un tableau)
        if (Array.isArray(result.data.preferredLines)) {
          setSelectedLines(result.data.preferredLines);
        } else if (typeof result.data.preferredLines === 'string' && result.data.preferredLines) {
          // Si c'était stocké comme string, le convertir en tableau
          setSelectedLines(result.data.preferredLines.split(',').map(l => l.trim()).filter(l => l));
        }

        // Charger les stations préférées
        if (Array.isArray(result.data.preferredStations)) {
          setSelectedStations(result.data.preferredStations);
        } else if (typeof result.data.preferredStations === 'string' && result.data.preferredStations) {
          setSelectedStations(result.data.preferredStations.split(',').map(s => s.trim()).filter(s => s));
        }
      }
    }
    setLoading(false);
  };

  // Sauvegarder un champ
  const handleSaveField = async (field) => {
    if (!formData[field].trim()) {
      Alert.alert('Erreur', 'Le champ ne peut pas être vide');
      return;
    }

    setSaving(true);
    const updates = { [field]: formData[field].trim() };
    const result = await updateUserProfile(updates);
    setSaving(false);

    if (result.success) {
      Alert.alert('Succès', 'Profil mis à jour avec succès');
      setEditMode({ ...editMode, [field]: false });
      await loadUserData(); // Recharger les données
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors de la mise à jour');
    }
  };

  // Annuler l'édition
  const handleCancelEdit = (field) => {
    setFormData({
      ...formData,
      [field]: userData[field] || '',
    });
    setEditMode({ ...editMode, [field]: false });
  };

  // Toggle une ligne
  // Activer le mode édition pour les lignes
  const handleEditLines = () => {
    setTempSelectedLines([...selectedLines]);
    setEditingLines(true);
  };

  // Annuler l'édition des lignes
  const handleCancelEditLines = () => {
    setTempSelectedLines([]);
    setEditingLines(false);
  };

  // Toggle ligne (utilise tempSelectedLines si en mode édition)
  const toggleLine = (lineValue) => {
    if (editingLines) {
      if (tempSelectedLines.includes(lineValue)) {
        setTempSelectedLines(tempSelectedLines.filter(l => l !== lineValue));
      } else {
        setTempSelectedLines([...tempSelectedLines, lineValue]);
      }
    }
  };

  // Sauvegarder les lignes préférées
  const handleSaveLines = async () => {
    setSaving(true);
    const result = await updatePreferredLines(tempSelectedLines);
    setSaving(false);

    if (result.success) {
      setSelectedLines([...tempSelectedLines]);
      setEditingLines(false);
      setTempSelectedLines([]);
      Alert.alert('Succès', 'Lignes préférées mises à jour');
      await loadUserData();
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors de la mise à jour');
    }
  };

  // Activer le mode édition pour les stations
  const handleEditStations = () => {
    setTempSelectedStations([...selectedStations]);
    setEditingStations(true);
  };

  // Annuler l'édition des stations
  const handleCancelEditStations = () => {
    setTempSelectedStations([]);
    setStationSearchQuery('');
    setEditingStations(false);
  };

  // Toggle sélection de station (utilise tempSelectedStations si en mode édition)
  const toggleStation = (station) => {
    if (editingStations) {
      if (tempSelectedStations.includes(station)) {
        setTempSelectedStations(tempSelectedStations.filter(s => s !== station));
      } else {
        setTempSelectedStations([...tempSelectedStations, station]);
      }
    }
  };

  // Sauvegarder les stations préférées
  const handleSaveStations = async () => {
    setSaving(true);
    const result = await updatePreferredStations(tempSelectedStations);
    setSaving(false);

    if (result.success) {
      setSelectedStations([...tempSelectedStations]);
      setEditingStations(false);
      setTempSelectedStations([]);
      setStationSearchQuery('');
      Alert.alert('Succès', 'Stations préférées mises à jour');
      await loadUserData();
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors de la mise à jour');
    }
  };

  // Classifier les lignes par catégorie
  const categorizeLines = () => {
    const categories = {
      'Métro': lignes.filter(l => l.label.startsWith('Métro ')),
      'RER': lignes.filter(l => l.label.startsWith('RER ')),
      'Tram': lignes.filter(l => l.label.startsWith('Tram ')),
      'Transilien': lignes.filter(l => l.label.startsWith('Ligne ')),
    };
    return categories;
  };

  const categories = categorizeLines();

  // Gérer le changement de photo de profil
  const handleChangePhoto = async () => {
    try {
      // Demander la permission d'accéder à la galerie
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission requise',
          'Vous devez autoriser l\'accès à la galerie pour changer votre photo de profil.'
        );
        return;
      }

      // Lancer le sélecteur d'image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingPhoto(true);

        const photoUri = result.assets[0].uri;
        const uploadResult = await updateProfilePhoto(photoUri);

        if (uploadResult.success) {
          Alert.alert('Succès', 'Photo de profil mise à jour avec succès');
          await loadUserData(); // Recharger les données
        } else {
          Alert.alert('Erreur', uploadResult.error || 'Erreur lors de la mise à jour de la photo');
        }

        setUploadingPhoto(false);
      }
    } catch (error) {
      setUploadingPhoto(false);
      console.error('Erreur lors du changement de photo:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du changement de photo');
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.iconActive} />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.colors.background }]}>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
        {/* En-tête avec photo */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          {/* Badge de tendance score */}
          {userData?.userScore !== undefined && userData?.userScore !== 0 && (
          <View style={[
            styles.scoreTrendBadge,
            { backgroundColor: userData?.userScore > 0 ? '#4CAF5020' : '#F4433620' }
          ]}>
            <Ionicons
              name={userData?.userScore > 0 ? "trending-up" : "trending-down"}
              size={20}
              color={userData?.userScore > 0 ? "#4CAF50" : "#F44336"}
            />
          </View>
        )}

        <View style={styles.profileSection}>
          <View style={styles.photoContainer}>
            <View style={styles.photoWrapper}>
              {userData?.photoURL ? (
                <Image
                  source={{ uri: userData.photoURL }}
                  style={styles.profilePhoto}
                />
              ) : (
                <View style={[
                  styles.profilePhoto,
                  styles.defaultProfilePhoto,
                  { backgroundColor: theme.name === 'dark' ? '#FFFFFF' : '#000000' }
                ]}>
                  <Ionicons
                    name="person"
                    size={60}
                    color={theme.name === 'dark' ? '#000000' : '#FFFFFF'}
                  />
                </View>
              )}
              <View style={[styles.photoBorder, { borderColor: theme.colors.iconActive }]} />

              {/* Bouton pour changer la photo */}
              <TouchableOpacity
                style={[
                  styles.changePhotoButton,
                  {
                    backgroundColor: theme.name === 'dark' ? '#FFFFFF' : '#000000',
                    borderColor: theme.name === 'dark' ? '#000000' : '#FFFFFF',
                  }
                ]}
                onPress={handleChangePhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={theme.name === 'dark' ? '#000000' : '#FFFFFF'} />
                ) : (
                  <Ionicons name="camera" size={20} color={theme.name === 'dark' ? '#000000' : '#FFFFFF'} />
                )}
              </TouchableOpacity>

              {/* Badge Premium */}
              {userData?.isPremium && (
                <View style={styles.premiumBadgeContainer}>
                  <PremiumBadge size={32} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.nameSection}>
            <Text style={[styles.displayName, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
              {userData?.firstName} {userData?.lastName}
            </Text>

            {/* Grade de l'utilisateur - Cliquable pour voir la pyramide */}
            <WalkthroughTooltip
              stepId={WALKTHROUGH_STEPS.PROFILE.GRADE_BADGE}
              title="Système de ranking"
              content="Votre grade dépend de votre score de contribution. Plus vous signalez d'incidents et recevez de likes, plus votre grade augmente. Cliquez pour voir tous les grades disponibles."
              placement="bottom"
            >
              <TouchableOpacity
                style={[
                  styles.gradeBadge,
                  {
                    backgroundColor: theme.name === 'light' ? '#F5F5F5' : theme.colors.cardBackgroundColor,
                    borderColor: theme.colors.border
                  }
                ]}
                onPress={() => setShowRankingModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="star"
                  size={16}
                  color={theme.name === 'light' ? '#FFD700' : '#FFFFFF'}
                />
                <Text style={[
                  styles.gradeText,
                  {
                    fontSize: fontSize.sizes.small,
                    color: theme.name === 'light' ? '#000000' : '#FFFFFF'
                  }
                ]}>
                  {userData?.grade || 'Touriste'}
                </Text>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={theme.name === 'light' ? '#666666' : '#AAAAAA'}
                />
              </TouchableOpacity>
            </WalkthroughTooltip>
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#4CAF5015' }]}>
              <Ionicons name="newspaper-outline" size={24} color="#4CAF50" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
                {userData?.postsCount || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Posts publiés
              </Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FF6B9D15' }]}>
              <Ionicons name="heart" size={24} color="#FF6B9D" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
                {userData?.likesCount || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Likes reçus
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Informations personnelles */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Informations personnelles
          </Text>
        </View>

        {/* Prénom */}
        {editMode.firstName ? (
          <View style={[styles.editModeContainer, { backgroundColor: theme.colors.post }]}>
            <View style={styles.editModeContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 0, marginTop: 0 }]}>
                Prénom
              </Text>
              <TextInput
                style={[
                  styles.inputFullWidth,
                  {
                    color: theme.colors.text,
                    fontSize: fontSize.sizes.body,
                    marginTop: 6,
                  }
                ]}
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                placeholder="Entrez votre prénom"
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus
              />
            </View>
            <View style={styles.editActionsInline}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.colors.iconActive }]}
                onPress={() => handleSaveField('firstName')}
                disabled={saving}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: '#DC3545' }]}
                onPress={() => handleCancelEdit('firstName')}
                disabled={saving}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="person-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Prénom
              </Text>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldValue, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  {userData?.firstName}
                </Text>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setEditMode({ ...editMode, firstName: true })}
                >
                  <Ionicons name="pencil" size={18} color={theme.colors.iconActive} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Nom de famille */}
        {editMode.lastName ? (
          <View style={[styles.editModeContainer, { backgroundColor: theme.colors.post }]}>
            <View style={styles.editModeContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 0, marginTop: 0 }]}>
                Nom de famille
              </Text>
              <TextInput
                style={[
                  styles.inputFullWidth,
                  {
                    color: theme.colors.text,
                    fontSize: fontSize.sizes.body,
                    marginTop: 6,
                  }
                ]}
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                placeholder="Entrez votre nom"
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus
              />
            </View>
            <View style={styles.editActionsInline}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.colors.iconActive }]}
                onPress={() => handleSaveField('lastName')}
                disabled={saving}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: '#DC3545' }]}
                onPress={() => handleCancelEdit('lastName')}
                disabled={saving}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="person-circle-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Nom de famille
              </Text>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldValue, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  {userData?.lastName}
                </Text>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setEditMode({ ...editMode, lastName: true })}
                >
                  <Ionicons name="pencil" size={18} color={theme.colors.iconActive} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Email */}
        {editMode.email ? (
          <View style={[styles.editModeContainer, { backgroundColor: theme.colors.post }]}>
            <View style={styles.editModeContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 0, marginTop: 0 }]}>
                Adresse email
              </Text>
              <TextInput
                style={[
                  styles.inputFullWidth,
                  {
                    color: theme.colors.text,
                    fontSize: fontSize.sizes.body,
                    marginTop: 6,
                  }
                ]}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Entrez votre email"
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus
              />
            </View>
            <View style={styles.editActionsInline}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.colors.iconActive }]}
                onPress={() => handleSaveField('email')}
                disabled={saving}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: '#DC3545' }]}
                onPress={() => handleCancelEdit('email')}
                disabled={saving}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="mail-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Adresse email
              </Text>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldValue, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  {userData?.email}
                </Text>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setEditMode({ ...editMode, email: true })}
                >
                  <Ionicons name="pencil" size={18} color={theme.colors.iconActive} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Lignes préférées */}
      <View style={styles.section}>
        <View style={[styles.sectionTitleContainer, { marginBottom: 12 }]}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Lignes préférées
          </Text>
        </View>

        {!editingLines ? (
          /* Mode consultation */
          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="train-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 0, marginTop: 0 }]}>
                Mes lignes
              </Text>
              {selectedLines.length > 0 ? (
                <View style={[styles.badgesContainer, { marginTop: 8 }]}>
                  {selectedLines.map((lineValue) => {
                    const ligne = lignes.find(l => l.value === lineValue);
                    if (!ligne) return null;
                    return (
                      <View
                        key={lineValue}
                        style={[styles.badge, { backgroundColor: ligne.backgroundColor }]}
                      >
                        <Text style={[styles.badgeText, { color: ligne.color }]}>
                          {ligne.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.fieldValue, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body, fontStyle: 'italic' }]}>
                  Aucune ligne sélectionnée
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: theme.colors.primary, marginBottom: 0 }]}
              onPress={handleEditLines}
            >
              <Ionicons name="pencil" size={18} color={theme.colors.iconActive} />
            </TouchableOpacity>
          </View>
        ) : (
          /* Mode édition */
          <>
            {/* Lignes sélectionnées temporairement */}
            {tempSelectedLines.length > 0 && (
              <View style={styles.selectedLinesContainer}>
                <Text style={[styles.subsectionTitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Sélectionnées ({tempSelectedLines.length})
                </Text>
                <View style={styles.badgesContainer}>
                  {tempSelectedLines.map((lineValue) => {
                    const ligne = lignes.find(l => l.value === lineValue);
                    if (!ligne) return null;
                    return (
                      <TouchableOpacity
                        key={lineValue}
                        style={[styles.badge, { backgroundColor: ligne.backgroundColor }]}
                        onPress={() => toggleLine(lineValue)}
                      >
                        <Text style={[styles.badgeText, { color: ligne.color }]}>
                          {ligne.label}
                        </Text>
                        <Ionicons name="close-circle" size={16} color={ligne.color} style={styles.badgeClose} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Sélecteur de lignes par catégorie */}
            {Object.entries(categories).map(([categoryName, categoryLines]) => (
              <View key={categoryName} style={styles.categoryContainer}>
                <Text style={[styles.categoryTitle, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  {categoryName}
                </Text>
                <View style={styles.badgesContainer}>
                  {categoryLines.map((ligne) => {
                    const isSelected = tempSelectedLines.includes(ligne.value);
                    return (
                      <AnimatedLineBadge
                        key={ligne.value}
                        ligne={ligne}
                        isSelected={isSelected}
                        onPress={() => toggleLine(ligne.value)}
                      />
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Boutons Enregistrer et Annuler */}
            <View style={styles.editActionsRow}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: '#DC354520', borderColor: '#DC3545' }]}
                onPress={handleCancelEditLines}
              >
                <Ionicons name="close" size={20} color="#DC3545" />
                <Text style={[styles.cancelButtonText, { fontSize: fontSize.sizes.body }]}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.iconActive }]}
                onPress={handleSaveLines}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={[styles.saveButtonText, { fontSize: fontSize.sizes.body }]}>
                      Enregistrer
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Stations préférées */}
      <View style={styles.section}>
        <View style={[styles.sectionTitleContainer, { marginBottom: 12 }]}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Arrêts préférés
          </Text>
        </View>

        {selectedLines.length === 0 ? (
          <View style={[styles.infoBox, { backgroundColor: theme.colors.navbar, borderColor: theme.colors.border }]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.iconActive} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Sélectionnez d'abord vos lignes préférées pour voir leurs stations
            </Text>
          </View>
        ) : !editingStations ? (
          /* Mode consultation */
          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="location-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 0, marginTop: 0 }]}>
                Mes arrêts préférés
              </Text>
              {selectedStations.length > 0 ? (
                <View style={[styles.stationsContainer, { marginTop: 8 }]}>
                  {selectedStations.map((station) => (
                    <View
                      key={station}
                      style={[styles.stationChip, { backgroundColor: theme.colors.primary, borderColor: '#E5E5E5' }]}
                    >
                      <Text style={[styles.stationText, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                        {station}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.fieldValue, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body, fontStyle: 'italic' }]}>
                  Aucune station sélectionnée
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: theme.colors.primary, marginBottom: 0 }]}
              onPress={handleEditStations}
            >
              <Ionicons name="pencil" size={18} color={theme.colors.iconActive} />
            </TouchableOpacity>
          </View>
        ) : (
          /* Mode édition */
          <>
            {/* Stations sélectionnées temporairement */}
            {tempSelectedStations.length > 0 && (
              <View style={styles.selectedLinesContainer}>
                <Text style={[styles.subsectionTitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Sélectionnées ({tempSelectedStations.length})
                </Text>
                <View style={styles.stationsContainer}>
                  {tempSelectedStations.map((station) => (
                    <TouchableOpacity
                      key={station}
                      style={[styles.stationChip, { backgroundColor: theme.colors.primary, borderColor: '#E5E5E5' }]}
                      onPress={() => toggleStation(station)}
                    >
                      <Text style={[styles.stationText, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                        {station}
                      </Text>
                      <Ionicons name="close-circle" size={16} color={theme.colors.iconActive} style={styles.stationClose} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Sélecteur de stations */}
            {availableStations.length > 0 && (
          <View style={styles.categoryContainer}>
            <Text style={[styles.categoryTitle, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Rechercher une station / gare
            </Text>

            {/* Barre de recherche */}
            <View style={styles.searchContainer}>
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
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
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
                .slice(0, 50) // Limiter à 50 résultats pour les performances
                .map((station) => {
                  const isSelected = tempSelectedStations.includes(station);
                  return (
                    <TouchableOpacity
                      key={station}
                      style={[
                        styles.stationChip,
                        {
                          backgroundColor: isSelected ? theme.colors.iconActive : theme.colors.navbar,
                          borderColor: '#E5E5E5',
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

            {/* Boutons Enregistrer et Annuler */}
            <View style={styles.editActionsRow}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: '#DC354520', borderColor: '#DC3545' }]}
                onPress={handleCancelEditStations}
              >
                <Ionicons name="close" size={20} color="#DC3545" />
                <Text style={[styles.cancelButtonText, { fontSize: fontSize.sizes.body }]}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.iconActive }]}
                onPress={handleSaveStations}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={[styles.saveButtonText, { fontSize: fontSize.sizes.body }]}>
                      Enregistrer
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de pyramide des rankings */}
      <Modal
        visible={showRankingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRankingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            {/* Header du modal */}
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  {
                    color: theme.colors.text,
                    fontSize: fontSize.sizes.subtitle,
                  }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Hiérarchie des grades
              </Text>
              <TouchableOpacity
                onPress={() => setShowRankingModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Pyramide des grades */}
            <ScrollView style={styles.pyramidContainer} showsVerticalScrollIndicator={false}>
              {GRADES_HIERARCHY.map((grade, index) => {
                const isCurrentGrade = userData?.grade === grade.name;
                const userScore = userData?.userScore || 0;
                const nextGrade = GRADES_HIERARCHY[index - 1];
                const scoreNeeded = nextGrade ? nextGrade.minScore - userScore : 0;

                return (
                  <View
                    key={grade.name}
                    style={[
                      styles.gradeRow,
                      isCurrentGrade && styles.currentGradeRow,
                      {
                        backgroundColor: isCurrentGrade
                          ? theme.colors.primary
                          : theme.colors.navbar,
                        borderColor: isCurrentGrade ? grade.color : theme.colors.border,
                      }
                    ]}
                  >
                    <View style={styles.gradeRowLeft}>
                      <Text style={styles.gradeEmoji}>{grade.emoji}</Text>
                      <View>
                        <Text style={[
                          styles.gradeName,
                          {
                            color: isCurrentGrade ? theme.colors.text : theme.colors.text,
                            fontSize: fontSize.sizes.body,
                            fontWeight: isCurrentGrade ? 'bold' : 'normal'
                          }
                        ]}>
                          {grade.name}
                        </Text>
                        {userData?.isPremium && (
                          <Text style={[
                            styles.gradeScore,
                            { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }
                          ]}>
                            {grade.minScore === 4.01 ? '4.01+' : `${grade.minScore.toFixed(2)}+`}
                          </Text>
                        )}
                      </View>
                    </View>

                    {isCurrentGrade && (
                      <View style={styles.currentBadge}>
                        <Ionicons name="checkmark-circle" size={20} color={grade.color} />
                        <Text style={[
                          styles.currentText,
                          { color: theme.colors.text, fontSize: fontSize.sizes.small }
                        ]}>
                          Vous êtes ici
                        </Text>
                      </View>
                    )}

                    {isCurrentGrade && nextGrade && scoreNeeded > 0 && userData?.isPremium && (
                      <View style={[styles.progressInfo, { backgroundColor: theme.colors.background }]}>
                        <Text style={[
                          styles.progressText,
                          { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }
                        ]}>
                          {scoreNeeded.toFixed(2)} points pour {nextGrade.emoji} {nextGrade.name}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
              {userData?.isPremium ? (
                <Text style={[styles.footerText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Votre score actuel : {userData?.userScore?.toFixed(2) || '0.00'}
                </Text>
              ) : (
                <View style={styles.premiumPrompt}>
                  <Ionicons name="diamond" size={20} color={theme.colors.iconActive} />
                  <Text style={[styles.footerText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginLeft: 8 }]}>
                    Passez à Premium pour suivre votre progression
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingTop: 85,
    paddingHorizontal: 20,
    position: 'relative',
  },
  scoreTrendBadge: {
    position: 'absolute',
    top: 70,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  photoContainer: {
    marginBottom: 20,
  },
  photoWrapper: {
    position: 'relative',
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 3,
  },
  premiumBadgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  defaultProfilePhoto: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    opacity: 0.3,
  },
  nameSection: {
    alignItems: 'center',
  },
  displayName: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 8,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  gradeText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statNumber: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: 'Fredoka_400Regular',
  },
  section: {
    padding: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
fieldCard: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
  padding: 10,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E5E5E5',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 1,
  gap: 12,
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
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: 'Fredoka_400Regular',
    marginBottom: -10,
    marginTop: 10
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  editModeContent: {
    flex: 1,
  },
  editActionsInline: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldValue: {
    fontFamily: 'Fredoka_500Medium',
    flex: 1,
  },
  input: {
    width: '100%',
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Fredoka_400Regular',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  inputFullWidth: {
    flex: 1,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontFamily: 'Fredoka_400Regular',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  selectedLinesContainer: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontFamily: 'Fredoka_500Medium',
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 3,
    minWidth: 70, // Largeur minimale pour uniformiser les badges
  },
  badgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
  },
  badgeClose: {
    marginLeft: 2,
  },
  badgeCheck: {
    marginLeft: 2,
  },
  editPreferencesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editPreferencesButtonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonText: {
    color: '#DC3545',
    fontFamily: 'Fredoka_600SemiBold',
  },
  stationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
  },
  stationText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11,
  },
  stationClose: {
    marginLeft: 2,
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
    marginBottom: 16,
  },
  infoText: {
    fontFamily: 'Fredoka_400Regular',
    flex: 1,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
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
  // Styles du modal de pyramide
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    gap: 12,
  },
  modalTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pyramidContainer: {
    padding: 15,
  },
  gradeRow: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  currentGradeRow: {
    borderWidth: 3,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  gradeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gradeEmoji: {
    fontSize: 32,
  },
  gradeName: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 2,
  },
  gradeScore: {
    fontFamily: 'Fredoka_400Regular',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  currentText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  progressInfo: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  progressText: {
    fontFamily: 'Fredoka_500Medium',
    textAlign: 'center',
  },
  modalFooter: {
    padding: 15,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  premiumPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

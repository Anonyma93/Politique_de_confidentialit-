import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useWalkthrough, WALKTHROUGH_STEPS } from '../context/WalkthroughContext';
import WalkthroughTooltip from '../components/WalkthroughTooltip';
import { lignes, trainDirections, stations, incidents } from '../data/lignes';
import { incrementPostsCount, getCurrentUser } from '../services/authService';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { showInterstitialAd } from '../services/adService';

export default function PostScreen({ navigation }) {
  const { theme, fontSize } = useTheme();
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);

  // Refs pour les sections du formulaire
  const directionSectionRef = useRef(null);
  const stationSectionRef = useRef(null);
  const incidentSectionRef = useRef(null);

  // États du formulaire
  const [postType, setPostType] = useState('incident'); // 'incident' ou 'info'
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedDirection, setSelectedDirection] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedSeverity, setSelectedSeverity] = useState(null);
  const [comment, setComment] = useState('');
  const [userCities, setUserCities] = useState(['Paris']); // Villes sélectionnées par l'utilisateur

  // Niveaux de gravité
  const severityLevels = [
    { value: 'sans', label: 'Sans', color: '#8CE9F6' },
    { value: 'minime', label: 'Minime', color: '#9FFFB4' },
    { value: 'perturbe', label: 'Perturbé', color: '#EBD6C3' },
    { value: 'tres_perturbe', label: 'Très perturbé', color: '#F69B4C' },
    { value: 'interrompu', label: 'Interrompu', color: '#BE1313' },
  ];

  // Charger les villes sélectionnées par l'utilisateur (à chaque fois que la page est affichée)
  useFocusEffect(
    React.useCallback(() => {
      const loadUserCities = async () => {
        const user = getCurrentUser();
        if (user) {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              // Utiliser cities (array) ou city (string pour rétro-compatibilité)
              const cities = userData.cities || (userData.city ? [userData.city] : ['Paris']);
              console.log('🏙️ Villes chargées depuis Firestore:', cities);
              setUserCities(cities);
            } else {
              console.log('⚠️ Document utilisateur non trouvé, utilisation de Paris par défaut');
            }
          } catch (error) {
            console.error('❌ Erreur lors du chargement des villes:', error);
          }
        }
      };

      const checkCityChange = async () => {
        try {
          // Récupérer le timestamp du changement de ville
          const cityChangedTimestamp = await AsyncStorage.getItem('cityChangedTimestamp');

          // Récupérer le timestamp de la dernière vérification
          const lastCheckedTimestamp = await AsyncStorage.getItem('lastCityCheckTimestamp');

          // Si la ville a changé depuis la dernière vérification, réinitialiser le formulaire
          if (cityChangedTimestamp && (!lastCheckedTimestamp || cityChangedTimestamp > lastCheckedTimestamp)) {
            console.log('🔄 Changement de ville détecté, réinitialisation du formulaire');

            // Réinitialiser tous les champs du formulaire
            setSelectedLine(null);
            setSelectedDirection(null);
            setSelectedStation(null);
            setSelectedIncident(null);
            setSelectedSeverity(null);
            setComment('');

            // Scroller vers le haut
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }

          // Mettre à jour le timestamp de la dernière vérification
          await AsyncStorage.setItem('lastCityCheckTimestamp', Date.now().toString());
        } catch (error) {
          console.error('❌ Erreur lors de la vérification du changement de ville:', error);
        }
      };

      loadUserCities();
      checkCityChange();
    }, [])
  );

  // Scroller vers le haut quand on arrive sur la page
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  // Données filtrées en fonction de la ligne sélectionnée
  const availableDirections = selectedLine ? trainDirections[selectedLine] || [] : [];
  const availableStations = selectedLine ? stations[selectedLine] || [] : [];

  // Classifier les lignes par ville puis par catégorie
  const categorizeLinesByCity = () => {
    console.log('📊 Catégorisation avec les villes:', userCities);
    const citiesData = {};

    userCities.forEach(city => {
      const cityLines = lignes.filter(ligne => {
        const ligneCity = ligne.city || 'Paris';
        return ligneCity === city;
      });

      console.log(`   🚇 ${city}: ${cityLines.length} lignes trouvées`);

      citiesData[city] = {
        'Métro': cityLines.filter(l => l.label.startsWith('Métro ')),
        'RER': cityLines.filter(l => l.label.startsWith('RER ')),
        'Tram': cityLines.filter(l => l.label.startsWith('Tram ')),
        'Transilien': cityLines.filter(l => l.label.startsWith('Ligne ')),
      };
    });

    return citiesData;
  };

  const citiesData = categorizeLinesByCity();

  // Sélectionner une ligne
  const handleSelectLine = (lineValue) => {
    if (selectedLine === lineValue) {
      // Désélectionner si on clique sur la même ligne
      setSelectedLine(null);
      setSelectedDirection(null);
      setSelectedStation(null);
    } else {
      // Sélectionner une nouvelle ligne
      setSelectedLine(lineValue);
      // Réinitialiser les sélections qui dépendent de la ligne
      setSelectedDirection(null);
      setSelectedStation(null);

      // Défiler vers la section direction après un court délai
      setTimeout(() => {
        directionSectionRef.current?.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
          },
          () => {}
        );
      }, 100);
    }
  };

  // Filtrer les incidents selon le type de post
  const getFilteredIncidents = () => {
    if (postType === 'info') {
      // Pour les informations, on n'affiche pas de liste, on applique automatiquement "Information"
      return [];
    } else {
      // Pour les incidents, on filtre pour retirer "Information"
      return incidents.filter(incident => incident.value !== 'Information');
    }
  };

  // Sélectionner une direction
  const handleSelectDirection = (direction) => {
    setSelectedDirection(direction);

    // Défiler vers la section station seulement si une direction est sélectionnée
    if (direction) {
      setTimeout(() => {
        stationSectionRef.current?.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
          },
          () => {}
        );
      }, 100);
    }
  };

  // Sélectionner une station
  const handleSelectStation = (station) => {
    setSelectedStation(station);

    // Défiler vers la section incident seulement si une station est sélectionnée
    if (station) {
      setTimeout(() => {
        incidentSectionRef.current?.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
          },
          () => {}
        );
      }, 100);
    }
  };

  // Valider le formulaire
  const validateForm = () => {
    if (!selectedLine) {
      Alert.alert('Erreur', 'Veuillez sélectionner une ligne');
      return false;
    }
    if (!selectedDirection) {
      Alert.alert('Erreur', 'Veuillez sélectionner une direction');
      return false;
    }
    if (!selectedStation) {
      Alert.alert('Erreur', 'Veuillez sélectionner une station');
      return false;
    }
    // Pour les incidents, on demande de sélectionner un motif
    // Pour les informations, le motif "Information" est appliqué automatiquement
    if (postType === 'incident' && !selectedIncident) {
      Alert.alert('Erreur', 'Veuillez sélectionner un motif d\'incident');
      return false;
    }
    if (postType === 'incident' && !selectedSeverity) {
      Alert.alert('Erreur', 'Veuillez sélectionner un niveau de gravité');
      return false;
    }
    if (!comment.trim()) {
      Alert.alert('Erreur', 'Veuillez ajouter un commentaire');
      return false;
    }
    if (comment.trim().length > 500) {
      Alert.alert('Erreur', 'Le commentaire ne peut pas dépasser 500 caractères');
      return false;
    }
    return true;
  };

  // Gérer le focus sur le champ de commentaire
  const handleCommentFocus = () => {
    // Attendre un peu que le clavier s'ouvre, puis scroller au maximum vers le bas
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 99999, animated: true });
    }, 300);
  };

  // Réinitialiser le formulaire
  const handleReset = () => {
    setSelectedLine(null);
    setSelectedDirection(null);
    setSelectedStation(null);
    setSelectedIncident(null);
    setSelectedSeverity(null);
    setComment('');
    // Scroller vers le haut
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Publier le post
  const handlePublish = async () => {
    if (!validateForm()) return;

    const user = getCurrentUser();
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour publier');
      return;
    }

    setLoading(true);

    try {
      // Récupérer les données utilisateur depuis Firestore pour obtenir le statut premium
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};

      // Récupérer la ville de la ligne sélectionnée
      const selectedLineData = lignes.find(ligne => ligne.value === selectedLine);
      const lineCity = selectedLineData?.city || 'Paris'; // Par défaut Paris si non défini

      // Créer le post dans Firestore
      const postData = {
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: user.displayName || 'Utilisateur',
        userPhotoURL: user.photoURL || null,
        userIsPremium: userData.isPremium || false,
        postType: postType, // 'incident' ou 'info'
        line: selectedLine,
        city: lineCity, // Ville de la ligne
        direction: selectedDirection,
        station: selectedStation,
        incident: postType === 'info' ? 'Information' : selectedIncident, // Appliquer automatiquement "Information" pour les infos
        severity: postType === 'incident' ? selectedSeverity : null,
        comment: comment.trim(),
        likesCount: 0,
        likedBy: [], // Liste des UIDs qui ont liké
        commentsCount: 0, // Compteur de commentaires
        confirmationsCount: 0, // Compteur de confirmations
        confirmedBy: [], // Liste des UIDs qui ont confirmé
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'posts'), postData);

      // Incrémenter le compteur de posts de l'utilisateur
      await incrementPostsCount();

      setLoading(false);

      Alert.alert(
        'Succès !',
        'Votre post a été publié avec succès',
        [
          {
            text: 'OK',
            onPress: async () => {
              // Afficher une publicité pour les utilisateurs non-premium
              // await showInterstitialAd(user.uid);

              // Réinitialiser le formulaire
              setSelectedLine(null);
              setSelectedDirection(null);
              setSelectedStation(null);
              setSelectedIncident(null);
              setSelectedSeverity(null);
              setComment('');
              // Rediriger vers Feed
              navigation.navigate('Feed');
            },
          },
        ]
      );
    } catch (error) {
      setLoading(false);
      console.error('Erreur lors de la publication du post:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la publication');
    }
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.colors.background }]}>
      {/* Mesh Gradient Background */}
     {/*  <View style={styles.meshGradientContainer} pointerEvents="none">
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        >
        {/* Titre de la page */}
        <View style={[styles.pageHeader, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.pageTitle, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
            Nouveau post
          </Text>
        </View>

        {/* Introduction au formulaire */}
        <View style={styles.section}>
          <WalkthroughTooltip
            stepId={WALKTHROUGH_STEPS.POST.INTRODUCTION}
            title="Créer un post"
            content="Signalez rapidement un incident ou partagez une information sur le trafic. Choisissez d'abord le type (Incident ou Information), puis sélectionnez la ligne, la direction, l'arrêt concerné et ajoutez vos détails. Pour un incident, indiquez également sa gravité."
            placement="bottom"
          >
            <View style={styles.introContainer}>
              <Ionicons name="help-circle-outline" size={20} color={theme.colors.iconActive} />
              <Text style={[styles.introText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Remplissez le formulaire ci-dessous pour partager une info trafic
              </Text>
            </View>
          </WalkthroughTooltip>
        </View>

        {/* Onglets pour choisir le type de post */}
        <View style={styles.section}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: postType === 'incident' ? theme.colors.primary : theme.colors.navbar,
                  borderColor: postType === 'incident' ? theme.colors.primary : theme.colors.border,
                }
              ]}
              onPress={() => {
                setPostType('incident');
                setSelectedIncident(null); // Réinitialiser le motif
                setSelectedSeverity(null); // Réinitialiser la gravité
              }}
            >
              <Ionicons
                name="warning"
                size={20}
                color={postType === 'incident' ? theme.colors.text : theme.colors.textSecondary}
              />
              <Text style={[
                styles.tabText,
                {
                  color: postType === 'incident' ? theme.colors.text : theme.colors.textSecondary,
                  fontSize: fontSize.sizes.body,
                }
              ]}>
                Incident
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: postType === 'info' ? theme.colors.primary : theme.colors.navbar,
                  borderColor: postType === 'info' ? theme.colors.primary : theme.colors.border,
                }
              ]}
              onPress={() => {
                setPostType('info');
                setSelectedIncident(null); // Réinitialiser le motif
                setSelectedSeverity(null); // Réinitialiser la gravité
              }}
            >
              <Ionicons
                name="information-circle"
                size={20}
                color={postType === 'info' ? theme.colors.text : theme.colors.textSecondary}
              />
              <Text style={[
                styles.tabText,
                {
                  color: postType === 'info' ? theme.colors.text : theme.colors.textSecondary,
                  fontSize: fontSize.sizes.body,
                }
              ]}>
                Information
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sélection de la ligne */}
        <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Ligne concernée *
          </Text>
        </View>
        {Object.entries(citiesData).map(([cityName, cityCategories]) => (
          <View key={cityName}>
            {/* Titre de la ville */}
            {userCities.length > 1 && (
              <Text style={[styles.cityTitle, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                {cityName}
              </Text>
            )}

            {/* Catégories de lignes pour cette ville */}
            {Object.entries(cityCategories).map(([categoryName, categoryLines]) => {
              // Filtrer pour n'afficher que la ligne sélectionnée si une ligne est sélectionnée
              const filteredLines = selectedLine
                ? categoryLines.filter(ligne => ligne.value === selectedLine)
                : categoryLines;

              // Ne pas afficher la catégorie si elle est vide après filtrage
              if (filteredLines.length === 0) return null;

              return (
                <View key={`${cityName}-${categoryName}`} style={styles.categoryContainer}>
                  <View style={styles.badgesContainer}>
                    {filteredLines.map((ligne) => {
                      const isSelected = selectedLine === ligne.value;
                      return (
                        <TouchableOpacity
                          key={ligne.value}
                          style={[
                            styles.badge,
                            {
                              backgroundColor: ligne.backgroundColor,
                            }
                          ]}
                          onPress={() => handleSelectLine(ligne.value)}
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
              );
            })}
          </View>
        ))}
      </View>

      {/* Sélection de la direction */}
      {selectedLine && availableDirections.length > 0 && (
        <View style={styles.section} ref={directionSectionRef}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.titleAccent} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Direction *
            </Text>
          </View>
          <View style={styles.selectionsContainer}>
            {availableDirections
              .filter(direction => !selectedDirection || selectedDirection === direction.value)
              .map((direction) => {
              const isSelected = selectedDirection === direction.value;
              return (
                <TouchableOpacity
                  key={direction.value}
                  style={[
                    styles.selectionItem,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.navbar,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => handleSelectDirection(isSelected ? null : direction.value)}
                >
                  <Text
                    style={[
                      styles.selectionText,
                      {
                        color: isSelected ? theme.colors.text : theme.colors.text,
                        fontSize: fontSize.sizes.body,
                      }
                    ]}
                  >
                    {direction.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={theme.colors.text} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Sélection de la station */}
      {selectedLine && availableStations.length > 0 && (
        <View style={styles.section} ref={stationSectionRef}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.titleAccent} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Station *
            </Text>
          </View>
          <View style={styles.selectionsContainer}>
            {availableStations
              .filter(station => !selectedStation || selectedStation === station.value)
              .map((station) => {
              const isSelected = selectedStation === station.value;
              return (
                <TouchableOpacity
                  key={station.value}
                  style={[
                    styles.selectionItem,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.navbar,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => handleSelectStation(isSelected ? null : station.value)}
                >
                  <Text
                    style={[
                      styles.selectionText,
                      {
                        color: isSelected ? theme.colors.text : theme.colors.text,
                        fontSize: fontSize.sizes.body,
                      }
                    ]}
                  >
                    {station.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={theme.colors.text} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Sélection du motif d'incident (uniquement pour les incidents) */}
      {postType === 'incident' && (
        <View style={styles.section} ref={incidentSectionRef}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.titleAccent} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Motif de l'incident *
            </Text>
          </View>
          <View style={styles.selectionsContainer}>
            {getFilteredIncidents()
              .filter(incident => !selectedIncident || selectedIncident === incident.value)
              .map((incident) => {
              const isSelected = selectedIncident === incident.value;
              return (
                <TouchableOpacity
                  key={incident.value}
                  style={[
                    styles.selectionItem,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.navbar,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => setSelectedIncident(isSelected ? null : incident.value)}
                >
                  <Text
                    style={[
                      styles.selectionText,
                      {
                        color: isSelected ? theme.colors.text : theme.colors.text,
                        fontSize: fontSize.sizes.body,
                      }
                    ]}
                  >
                    {incident.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={theme.colors.text} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Sélection du niveau de gravité (uniquement pour les incidents) */}
      {postType === 'incident' && (
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.titleAccent} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Niveau de gravité *
            </Text>
          </View>
          <View style={styles.selectionsContainer}>
            {severityLevels
              .filter(severity => !selectedSeverity || selectedSeverity === severity.value)
              .map((severity) => {
              const isSelected = selectedSeverity === severity.value;
              return (
                <TouchableOpacity
                  key={severity.value}
                  style={[
                    styles.selectionItem,
                    {
                      backgroundColor: isSelected ? severity.color : theme.colors.navbar,
                      borderColor: isSelected ? severity.color : theme.colors.border,
                    }
                  ]}
                  onPress={() => setSelectedSeverity(isSelected ? null : severity.value)}
                >
                  <Text
                    style={[
                      styles.selectionText,
                      {
                        color: isSelected ? '#fff' : theme.colors.text,
                        fontSize: fontSize.sizes.body,
                      }
                    ]}
                  >
                    {severity.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Commentaire */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Commentaire *
          </Text>
        </View>
        <TextInput
          style={[
            styles.commentInput,
            {
              backgroundColor: theme.colors.navbar,
              color: theme.colors.text,
              borderColor: theme.colors.border,
              fontSize: fontSize.sizes.body,
            }
          ]}
          placeholder="Décrivez la situation (max 500 caractères)..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={4}
          maxLength={500}
          value={comment}
          onChangeText={setComment}
          onFocus={handleCommentFocus}
        />
        <Text style={[styles.characterCount, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
          {comment.length} / 500 caractères
        </Text>
      </View>

      {/* Boutons d'action */}
      <View style={styles.section}>
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[
              styles.resetButton,
              {
                backgroundColor: theme.colors.navbar,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={handleReset}
            disabled={loading}
          >
            <Ionicons name="refresh" size={20} color={theme.colors.text} />
            <Text style={[styles.resetButtonText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Réinitialiser
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.publishButton,
              {
                backgroundColor: '#007AFF',
                opacity: loading ? 0.6 : 1,
              }
            ]}
            onPress={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={[styles.publishButtonText, { fontSize: fontSize.sizes.body }]}>
                  {postType === 'incident' ? 'Publier' : 'Publier'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
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
    paddingTop: 0,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
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
  selectedLineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  selectedLineLabel: {
    fontFamily: 'Fredoka_500Medium',
  },
  selectedLineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedLineText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  cityTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 15,
    marginTop: 10,
    paddingLeft: 5,
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
  selectionsContainer: {
    gap: 10,
  },
  selectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
  },
  selectionText: {
    fontFamily: 'Fredoka_500Medium',
    flex: 1,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontFamily: 'Fredoka_400Regular',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  characterCount: {
    fontFamily: 'Fredoka_400Regular',
    marginTop: 5,
    textAlign: 'right',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
  },
  resetButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  publishButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  publishButtonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  tabText: {
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

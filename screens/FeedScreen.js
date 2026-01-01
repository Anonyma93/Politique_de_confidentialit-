import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useWalkthrough, WALKTHROUGH_STEPS } from '../context/WalkthroughContext';
import WalkthroughTooltip from '../components/WalkthroughTooltip';
import { lignes } from '../data/lignes';
import { getCurrentUser, getUserData, incrementLikesCount, decrementLikesCount, incrementLikesGiven, decrementLikesGiven } from '../services/authService';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { setBadgeCount } from '../services/notificationService';
import PremiumBadge from '../components/PremiumBadge';

// Composant de post animé
const AnimatedPostCard = ({ post, theme, fontSize, currentUser, onLike, getSeverityColor, navigation, showDetailsTooltip = false }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Si pas de photo (avatar par défaut), considérer comme chargé
    if (!post.userPhotoURL) {
      setImageLoaded(true);
    }
  }, [post.userPhotoURL]);

  useEffect(() => {
    // Déclencher l'animation seulement quand l'image est chargée
    if (imageLoaded) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [imageLoaded]);

  const ligne = lignes.find(l => l.value === post.line);
  const hasLiked = post.likedBy?.includes(currentUser?.uid);
  const isOwnPost = post.userId === currentUser?.uid;
  const severityColor = getSeverityColor(post.severity, post.postType);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;

    // Pour 1h ou plus, afficher l'heure exacte
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Obtenir le label de gravité
  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'sans':
        return 'Sans';
      case 'minime':
        return 'Minime';
      case 'perturbe':
        return 'Perturbé';
      case 'tres_perturbe':
        return 'Très perturbé';
      case 'interrompu':
        return 'Interrompu';
      default:
        return '';
    }
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ],
      }}
    >
      <View style={[
        styles.postCard,
        {
          backgroundColor: theme.colors.post,
          borderLeftColor: severityColor,
          borderRightColor: severityColor,
          borderTopColor: severityColor,
          borderBottomColor: severityColor,
        }
      ]}>
        {/* Badge ligne en haut à gauche */}
        {ligne && (
          <View style={[styles.lineBadgeTopLeft, { backgroundColor: ligne.backgroundColor }]}>
            <Text style={[styles.lineBadgeTopLeftText, { color: ligne.color, fontSize: fontSize.sizes.small }]}>
              {ligne.label}
            </Text>
          </View>
        )}

        {/* Bouton like en haut à droite */}
        <TouchableOpacity
          style={[styles.likeButtonTopRight, { backgroundColor: theme.colors.navbar }]}
          onPress={() => onLike(post)}
          disabled={isOwnPost}
        >
          <Ionicons
            name={hasLiked ? "heart" : "heart-outline"}
            size={20}
            color={hasLiked ? "#FF6B9D" : theme.colors.iconInactive}
          />
          <Text style={[styles.likeCount, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
            {post.likesCount || 0}
          </Text>
        </TouchableOpacity>

        {/* Header du post */}
        <View style={styles.postHeader}>
          <View style={{ alignItems: 'center', width: '100%' }}>
            {/* Photo de profil */}
            <TouchableOpacity
              onPress={() => !isOwnPost && navigation.navigate('UserProfile', { userId: post.userId })}
              activeOpacity={isOwnPost ? 1 : 0.7}
              style={styles.avatarContainer}
            >
              {post.userPhotoURL ? (
                <Image
                  source={{ uri: post.userPhotoURL }}
                  style={styles.avatar}
                  onLoad={() => setImageLoaded(true)}
                />
              ) : (
                <View style={[
                  styles.avatar,
                  styles.defaultAvatar,
                  { backgroundColor: theme.name === 'dark' ? '#FFFFFF' : '#000000' }
                ]}>
                  <Ionicons
                    name="person"
                    size={32}
                    color={theme.name === 'dark' ? '#000000' : '#FFFFFF'}
                  />
                </View>
              )}

              {/* Badge Premium */}
              {post.userIsPremium && (
                <View style={styles.postPremiumBadge}>
                  <PremiumBadge size={20} />
                </View>
              )}
            </TouchableOpacity>

            {/* Nom */}
            <TouchableOpacity
              onPress={() => !isOwnPost && navigation.navigate('UserProfile', { userId: post.userId })}
              activeOpacity={isOwnPost ? 1 : 0.7}
            >
              <Text style={[styles.userName, { color: theme.colors.text, fontSize: fontSize.sizes.body, marginTop: 8 }]}>
                {post.userDisplayName || 'Utilisateur'}
                {isOwnPost && (
                  <Text style={{ color: theme.colors.iconActive }}> (Vous)</Text>
                )}
              </Text>
            </TouchableOpacity>

            {/* Gare et direction */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Ionicons name="location" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.postInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginLeft: 4 }]}>
                {post.station}
              </Text>
              <Text style={[styles.postInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginHorizontal: 6 }]}>
                -
              </Text>
              <Ionicons name="navigate" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.postInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginLeft: 4 }]}>
                {post.direction}
              </Text>
            </View>

            {/* Badges */}
            <View style={[styles.postBadges, { marginTop: 8, justifyContent: 'center' }]}>
              {/* Badge gravité - masqué pour les posts de type info */}
              {post.postType !== 'info' && post.severity && (
                <View style={[
                  styles.badge,
                  {
                    backgroundColor: severityColor,
                  }
                ]}>
                  <Text style={[styles.badgeText, { color: post.severity === 'interrompu' ? '#FFF' : '#000' }]}>
                    {getSeverityLabel(post.severity)}
                  </Text>
                </View>
              )}

              {/* Badge incident */}
              <View style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.primary,
                }
              ]}>
                <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                  {post.incident}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section Commentaire */}
        {showDetailsTooltip ? (
          <WalkthroughTooltip
            stepId={WALKTHROUGH_STEPS.FEED.POST_DETAILS}
            title="Comprendre un post"
            content="Chaque post affiche : la ligne (en haut à gauche), la destination et l'arrêt concernés, la gravité de l'incident (qu'on peut retrouver avec la couleur de la bordure du post), le motif de l'incident, un commentaire pour expliquer en détail le post et un bouton like pour indiquer que vous validez celui-ci."
            placement="bottom"
            previousStepId={WALKTHROUGH_STEPS.FEED.USER_PROFILE_CLICK}
          >
            <View style={styles.commentSection}>
              <View style={styles.commentHeader}>
                <View style={[styles.commentTopBorder, { borderTopColor: '#E0E0E0' }]} />
                <Text style={[styles.commentTitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Commentaire
                </Text>
                <View style={[styles.commentTopBorder, { borderTopColor: '#E0E0E0' }]} />
              </View>
              <Text style={[styles.postComment, { color: theme.colors.text, fontSize: fontSize.sizes.body, textAlign: 'center' }]}>
                {post.comment}
              </Text>
              <Text style={[styles.postTime, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, textAlign: 'center', marginTop: 8 }]}>
                {formatDate(post.createdAt)}
              </Text>
            </View>
          </WalkthroughTooltip>
        ) : (
          <View style={styles.commentSection}>
            <View style={styles.commentHeader}>
              <View style={[styles.commentTopBorder, { borderTopColor: '#E0E0E0' }]} />
              <Text style={[styles.commentTitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Commentaire
              </Text>
              <View style={[styles.commentTopBorder, { borderTopColor: '#E0E0E0' }]} />
            </View>
            <Text style={[styles.postComment, { color: theme.colors.text, fontSize: fontSize.sizes.body, textAlign: 'center' }]}>
              {post.comment}
            </Text>
            <Text style={[styles.postTime, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, textAlign: 'center', marginTop: 8 }]}>
              {formatDate(post.createdAt)}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

export default function FeedScreen({ navigation }) {
  const { theme, fontSize } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = getCurrentUser();

  // Filtres (sélection multiple)
  const [selectedLines, setSelectedLines] = useState([]);
  const [selectedDirections, setSelectedDirections] = useState([]);
  const [selectedStations, setSelectedStations] = useState([]);
  const [selectedIncidents, setSelectedIncidents] = useState([]);
  const [selectedSeverities, setSelectedSeverities] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Préférences utilisateur
  const [userPreferredLines, setUserPreferredLines] = useState([]);
  const [userPreferredStations, setUserPreferredStations] = useState([]);
  const [userCities, setUserCities] = useState(['Paris']); // Villes sélectionnées par l'utilisateur

  // Filtres rapides basés sur les préférences
  const [quickFilterLines, setQuickFilterLines] = useState(false);
  const [quickFilterStations, setQuickFilterStations] = useState(false);
  const [quickFilterBoth, setQuickFilterBoth] = useState(false);

  // Niveaux de gravité
  const severityLevels = [
    { value: 'sans', label: 'Sans', color: '#8CE9F6' },
    { value: 'minime', label: 'Minime', color: '#9FFFB4' },
    { value: 'perturbe', label: 'Perturbé', color: '#EBD6C3' },
    { value: 'tres_perturbe', label: 'Très perturbé', color: '#F69B4C' },
    { value: 'interrompu', label: 'Interrompu', color: '#BE1313' },
  ];

  // Charger les préférences utilisateur
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (currentUser) {
        const result = await getUserData(currentUser.uid);
        if (result.success) {
          setUserPreferredLines(result.data.preferredLines || []);
          setUserPreferredStations(result.data.preferredStations || []);
          // Charger les villes sélectionnées (array) ou city (string pour rétro-compatibilité)
          const cities = result.data.cities || (result.data.city ? [result.data.city] : ['Paris']);
          setUserCities(cities);
        }
      }
    };
    loadUserPreferences();
  }, [currentUser]);

  // Reset le badge count quand l'utilisateur arrive sur la page Feed
  useFocusEffect(
    React.useCallback(() => {
      setBadgeCount(0);
    }, [])
  );

  // Charger les posts en temps réel
  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(postsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Rafraîchir
  const handleRefresh = () => {
    setRefreshing(true);
    // Comme on utilise onSnapshot qui écoute en temps réel,
    // on arrête juste le refreshing après un court délai
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Gérer le like/unlike
  const handleLike = async (post) => {
    if (!currentUser) return;

    // Empêcher de liker son propre post
    if (post.userId === currentUser.uid) return;

    const postRef = doc(db, 'posts', post.id);
    const hasLiked = post.likedBy?.includes(currentUser.uid);

    try {
      if (hasLiked) {
        // Unlike
        await updateDoc(postRef, {
          likesCount: post.likesCount - 1,
          likedBy: arrayRemove(currentUser.uid),
        });
        // Décrémenter les likes de l'auteur
        await decrementLikesCount(post.userId);
        // Décrémenter les likes donnés par l'utilisateur courant
        await decrementLikesGiven(currentUser.uid);
      } else {
        // Like
        await updateDoc(postRef, {
          likesCount: post.likesCount + 1,
          likedBy: arrayUnion(currentUser.uid),
        });
        // Incrémenter les likes de l'auteur
        await incrementLikesCount(post.userId);
        // Incrémenter les likes donnés par l'utilisateur courant
        await incrementLikesGiven(currentUser.uid);
      }
    } catch (error) {
      console.error('Erreur lors du like:', error);
    }
  };

  // Gestionnaires de filtres rapides
  const handleQuickFilterLines = () => {
    if (quickFilterLines) {
      // Désactiver le filtre lignes
      setQuickFilterLines(false);
      setQuickFilterBoth(false);
    } else {
      // Activer le filtre lignes
      setQuickFilterLines(true);
      setQuickFilterStations(false);
    }
  };

  const handleQuickFilterStations = () => {
    if (quickFilterStations) {
      // Désactiver le filtre stations
      setQuickFilterStations(false);
      setQuickFilterBoth(false);
    } else {
      // Activer le filtre stations
      setQuickFilterStations(true);
      setQuickFilterLines(false);
    }
  };

  const handleQuickFilterBoth = () => {
    if (quickFilterBoth) {
      // Désactiver les deux
      setQuickFilterBoth(false);
      setQuickFilterLines(false);
      setQuickFilterStations(false);
    } else {
      // Activer les deux
      setQuickFilterBoth(true);
      setQuickFilterLines(false);
      setQuickFilterStations(false);
    }
  };

  // Filtrer les posts
  const filteredPosts = posts.filter(post => {
    // Filtre automatique par ville (basé sur les villes sélectionnées par l'utilisateur)
    const postCity = post.city || 'Paris'; // Par défaut Paris si non défini
    if (userCities.length > 0 && !userCities.includes(postCity)) return false;

    // Filtres rapides basés sur les préférences utilisateur
    if (quickFilterBoth) {
      const matchesLine = userPreferredLines.length > 0 && userPreferredLines.includes(post.line);
      const matchesStation = userPreferredStations.length > 0 && userPreferredStations.includes(post.station);
      if (!matchesLine || !matchesStation) return false;
    } else if (quickFilterLines) {
      if (userPreferredLines.length > 0 && !userPreferredLines.includes(post.line)) return false;
    } else if (quickFilterStations) {
      if (userPreferredStations.length > 0 && !userPreferredStations.includes(post.station)) return false;
    }

    // Filtres manuels
    if (selectedLines.length > 0 && !selectedLines.includes(post.line)) return false;
    if (selectedDirections.length > 0 && !selectedDirections.includes(post.direction)) return false;
    if (selectedStations.length > 0 && !selectedStations.includes(post.station)) return false;
    if (selectedIncidents.length > 0 && !selectedIncidents.includes(post.incident)) return false;
    if (selectedSeverities.length > 0 && !selectedSeverities.includes(post.severity)) return false;
    return true;
  });

  // Réinitialiser les filtres
  const clearFilters = () => {
    setSelectedLines([]);
    setSelectedDirections([]);
    setSelectedStations([]);
    setSelectedIncidents([]);
    setSelectedSeverities([]);
    setQuickFilterLines(false);
    setQuickFilterStations(false);
    setQuickFilterBoth(false);
  };

  // Obtenir les options uniques pour les filtres
  const getUniqueLines = () => {
    const lines = [...new Set(posts.map(p => p.line))];
    return lignes.filter(l => lines.includes(l.value));
  };

  const getUniqueDirections = () => {
    // Si des lignes sont sélectionnées, afficher seulement leurs directions
    if (selectedLines.length > 0) {
      return [...new Set(posts.filter(p => selectedLines.includes(p.line)).map(p => p.direction))];
    }
    // Sinon, afficher toutes les directions disponibles
    return [...new Set(posts.map(p => p.direction))];
  };

  const getUniqueStations = () => {
    // Si des lignes sont sélectionnées, afficher seulement leurs stations
    if (selectedLines.length > 0) {
      return [...new Set(posts.filter(p => selectedLines.includes(p.line)).map(p => p.station))];
    }
    // Sinon, afficher toutes les stations disponibles
    return [...new Set(posts.map(p => p.station))];
  };

  const getUniqueIncidents = () => {
    return [...new Set(posts.map(p => p.incident))];
  };

  // Formater la date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Obtenir la couleur de gravité
  const getSeverityColor = (severity, postType) => {
    // Pour les posts de type "info", utiliser une couleur bleue pour l'information
    if (postType === 'info' || !severity) {
      return '#8CE9F6'; // Bleu clair pour information
    }

    switch (severity) {
      case 'sans':
        return '#8CE9F6'; // Bleu clair
      case 'minime':
        return '#9FFFB4'; // Vert clair
      case 'perturbe':
        return '#EBD6C3'; // Beige
      case 'tres_perturbe':
        return '#F69B4C'; // Orange
      case 'interrompu':
        return '#BE1313'; // Rouge foncé
      default:
        return 'transparent'; // Pas de contour par défaut
    }
  };

  // Rendu d'un post
  const renderPost = ({ item: post, index }) => {
    const postCard = (
      <AnimatedPostCard
        post={post}
        theme={theme}
        fontSize={fontSize}
        currentUser={currentUser}
        onLike={handleLike}
        getSeverityColor={getSeverityColor}
        navigation={navigation}
        showDetailsTooltip={index === 0}
      />
    );

    // Ajouter le tooltip du profil uniquement sur le premier post
    if (index === 0) {
      return (
        <WalkthroughTooltip
          stepId={WALKTHROUGH_STEPS.FEED.USER_PROFILE_CLICK}
          title="Voir le profil"
          content="Cliquez sur le nom ou la photo d'un post pour voir le profil de l'utilisateur et ses statistiques."
          placement="top"
          previousStepId={WALKTHROUGH_STEPS.FEED.FILTER_BUTTONS}
        >
          {postCard}
        </WalkthroughTooltip>
      );
    }

    return postCard;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.iconActive} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
          Chargement des incidents...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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

      {/* Titre de la page */}
      <View style={[styles.pageHeader, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.pageTitle, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
          Fil d'actualité
        </Text>
      </View>

      {/* En-tête avec filtres */}
      <View style={[styles.header, { backgroundColor: theme.colors.navbar }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
            {filteredPosts.length} incident{filteredPosts.length > 1 ? 's' : ''} affiché{filteredPosts.length > 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: showFilters ? theme.colors.iconActive : theme.colors.background }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={20} color={showFilters ? '#fff' : theme.colors.iconActive} />
          </TouchableOpacity>
        </View>

        {/* Section de filtrage */}
        {showFilters && (
          <View style={styles.filtersSection}>
            {/* Filtres actifs */}
            {(selectedLines.length > 0 || selectedDirections.length > 0 || selectedStations.length > 0 || selectedIncidents.length > 0 || selectedSeverities.length > 0) && (
              <View style={styles.activeFilters}>
                {selectedLines.map(line => (
                  <TouchableOpacity
                    key={line}
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.iconActive }]}
                    onPress={() => setSelectedLines(selectedLines.filter(l => l !== line))}
                  >
                    <Text style={styles.activeFilterText}>{lignes.find(l => l.value === line)?.label}</Text>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                ))}
                {selectedDirections.map(direction => (
                  <TouchableOpacity
                    key={direction}
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.iconActive }]}
                    onPress={() => setSelectedDirections(selectedDirections.filter(d => d !== direction))}
                  >
                    <Text style={styles.activeFilterText}>{direction}</Text>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                ))}
                {selectedStations.map(station => (
                  <TouchableOpacity
                    key={station}
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.iconActive }]}
                    onPress={() => setSelectedStations(selectedStations.filter(s => s !== station))}
                  >
                    <Text style={styles.activeFilterText}>{station}</Text>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                ))}
                {selectedIncidents.map(incident => (
                  <TouchableOpacity
                    key={incident}
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.iconActive }]}
                    onPress={() => setSelectedIncidents(selectedIncidents.filter(i => i !== incident))}
                  >
                    <Text style={styles.activeFilterText}>{incident}</Text>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                ))}
                {selectedSeverities.map(severity => (
                  <TouchableOpacity
                    key={severity}
                    style={[styles.activeFilterChip, { backgroundColor: theme.colors.iconActive }]}
                    onPress={() => setSelectedSeverities(selectedSeverities.filter(s => s !== severity))}
                  >
                    <Text style={styles.activeFilterText}>{severityLevels.find(s => s.value === severity)?.label}</Text>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.clearFiltersButton, { backgroundColor: theme.colors.background }]}
                  onPress={clearFilters}
                >
                  <Text style={[styles.clearFiltersText, { color: theme.colors.text }]}>Réinitialiser</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Filtre par ligne */}
            {getUniqueLines().length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  Ligne
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {getUniqueLines().map(ligne => (
                    <TouchableOpacity
                      key={ligne.value}
                      style={[
                        styles.filterBadge,
                        { backgroundColor: ligne.backgroundColor, opacity: selectedLines.includes(ligne.value) ? 1 : 0.5 }
                      ]}
                      onPress={() => {
                        if (selectedLines.includes(ligne.value)) {
                          setSelectedLines(selectedLines.filter(l => l !== ligne.value));
                        } else {
                          setSelectedLines([...selectedLines, ligne.value]);
                        }
                      }}
                    >
                      <Text style={[styles.filterBadgeText, { color: ligne.color }]}>{ligne.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Filtre par direction */}
            {getUniqueDirections().length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  Direction
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {getUniqueDirections().map(direction => (
                    <TouchableOpacity
                      key={direction}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selectedDirections.includes(direction) ? theme.colors.iconActive : theme.colors.background,
                          borderColor: theme.colors.border,
                        }
                      ]}
                      onPress={() => {
                        if (selectedDirections.includes(direction)) {
                          setSelectedDirections(selectedDirections.filter(d => d !== direction));
                        } else {
                          setSelectedDirections([...selectedDirections, direction]);
                        }
                      }}
                    >
                      <Text style={[styles.filterChipText, {
                        color: selectedDirections.includes(direction) ? '#fff' : theme.colors.text,
                        fontSize: fontSize.sizes.small
                      }]}>
                        {direction}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Filtre par station/gare */}
            {getUniqueStations().length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  Gare / Station
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {getUniqueStations().map(station => (
                    <TouchableOpacity
                      key={station}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selectedStations.includes(station) ? theme.colors.iconActive : theme.colors.background,
                          borderColor: theme.colors.border,
                        }
                      ]}
                      onPress={() => {
                        if (selectedStations.includes(station)) {
                          setSelectedStations(selectedStations.filter(s => s !== station));
                        } else {
                          setSelectedStations([...selectedStations, station]);
                        }
                      }}
                    >
                      <Text style={[styles.filterChipText, {
                        color: selectedStations.includes(station) ? '#fff' : theme.colors.text,
                        fontSize: fontSize.sizes.small
                      }]}>
                        {station}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Filtre par motif */}
            {getUniqueIncidents().length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  Motif
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {getUniqueIncidents().map(incident => (
                    <TouchableOpacity
                      key={incident}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selectedIncidents.includes(incident) ? theme.colors.iconActive : theme.colors.background,
                          borderColor: theme.colors.border,
                        }
                      ]}
                      onPress={() => {
                        if (selectedIncidents.includes(incident)) {
                          setSelectedIncidents(selectedIncidents.filter(i => i !== incident));
                        } else {
                          setSelectedIncidents([...selectedIncidents, incident]);
                        }
                      }}
                    >
                      <Text style={[styles.filterChipText, {
                        color: selectedIncidents.includes(incident) ? '#fff' : theme.colors.text,
                        fontSize: fontSize.sizes.small
                      }]}>
                        {incident}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Filtre par gravité */}
            {severityLevels.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  Gravité
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {severityLevels.map((severity) => (
                    <TouchableOpacity
                      key={severity.value}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selectedSeverities.includes(severity.value) ? severity.color : theme.colors.background,
                          borderColor: severity.color,
                          borderWidth: 1,
                        }
                      ]}
                      onPress={() => {
                        if (selectedSeverities.includes(severity.value)) {
                          setSelectedSeverities(selectedSeverities.filter(s => s !== severity.value));
                        } else {
                          setSelectedSeverities([...selectedSeverities, severity.value]);
                        }
                      }}
                    >
                      <Text style={[
                        styles.filterChipText,
                        {
                          color: selectedSeverities.includes(severity.value) ? '#fff' : theme.colors.text,
                          fontSize: fontSize.sizes.small
                        }
                      ]}>
                        {severity.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Filtres rapides basés sur les préférences utilisateur */}
      {(userPreferredLines.length > 0 || userPreferredStations.length > 0) && (
        <View style={[styles.quickFiltersContainer, { backgroundColor: theme.colors.background }]}>
          <WalkthroughTooltip
            stepId={WALKTHROUGH_STEPS.FEED.FILTER_BUTTONS}
            title="Filtres rapides"
            content="Utilisez ces filtres pour voir rapidement les incidents sur vos lignes et arrêts préférés. Cliquez sur 'Les deux' pour filtrer par lignes ET arrêts en même temps."
            placement="bottom"
          >
            <View style={styles.quickFiltersRow}>
              {userPreferredLines.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.quickFilterBadge,
                    {
                      backgroundColor: quickFilterLines ? theme.colors.primary : theme.colors.navbar,
                      borderColor: quickFilterLines ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={handleQuickFilterLines}
                >
                  <Ionicons
                    name="train"
                    size={18}
                    color={quickFilterLines ? theme.colors.iconActive : theme.colors.iconActive}
                  />
                  <Text style={[
                    styles.quickFilterText,
                    {
                      color: quickFilterLines ? theme.colors.iconActive : theme.colors.text,
                      fontSize: fontSize.sizes.small
                    }
                  ]}>
                    Mes lignes
                  </Text>
                </TouchableOpacity>
              )}

              {userPreferredStations.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.quickFilterBadge,
                    {
                      backgroundColor: quickFilterStations ? theme.colors.primary : theme.colors.navbar,
                      borderColor: quickFilterStations ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={handleQuickFilterStations}
                >
                  <Ionicons
                    name="location"
                    size={18}
                    color={quickFilterStations ? theme.colors.iconActive : theme.colors.iconActive}
                  />
                  <Text style={[
                    styles.quickFilterText,
                    {
                      color: quickFilterStations ? theme.colors.iconActive : theme.colors.text,
                      fontSize: fontSize.sizes.small
                    }
                  ]}>
                    Mes arrêts
                  </Text>
                </TouchableOpacity>
              )}

              {userPreferredLines.length > 0 && userPreferredStations.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.quickFilterBadge,
                    {
                      backgroundColor: quickFilterBoth ? theme.colors.primary : theme.colors.navbar,
                      borderColor: quickFilterBoth ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={handleQuickFilterBoth}
                >
                  <Ionicons
                    name="star"
                    size={18}
                    color={quickFilterBoth ? theme.colors.iconActive : theme.colors.iconActive}
                  />
                  <Text style={[
                    styles.quickFilterText,
                    {
                      color: quickFilterBoth ? theme.colors.iconActive : theme.colors.text,
                      fontSize: fontSize.sizes.small
                    }
                  ]}>
                    Les deux
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </WalkthroughTooltip>
        </View>
      )}

      {/* Information réinitialisation */}
      <View style={[styles.resetInfoContainer, { backgroundColor: theme.colors.navbar }]}>
        <WalkthroughTooltip
          stepId={WALKTHROUGH_STEPS.FEED.RESET_INFO}
          title="Réinitialisation quotidienne"
          content="Tous les posts sont automatiquement supprimés chaque jour à 4h00 du matin pour garantir que seules les informations récentes et pertinentes sont affichées."
          placement="bottom"
          previousStepId={WALKTHROUGH_STEPS.FEED.POST_DETAILS}
        >
          <View style={styles.resetInfoContent}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.iconActive} />
            <Text style={[styles.resetInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Les posts sont réinitialisés quotidiennement à 4h00
            </Text>
          </View>
        </WalkthroughTooltip>
      </View>

      {/* Liste des posts */}
      {filteredPosts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="newspaper-outline" size={64} color={theme.colors.iconInactive} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            {posts.length === 0 ? 'Aucun incident signalé' : 'Aucun résultat'}
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            {posts.length === 0
              ? 'Soyez le premier à partager une info trafic !'
              : 'Essayez de modifier vos filtres'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.iconActive}
            />
          }
        />
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: 'Fredoka_400Regular',
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
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 1,

  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontFamily: 'Fredoka_400Regular',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersSection: {
    marginTop: 15,
    gap: 12,
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearFiltersText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  filterBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  listContent: {
    paddingBottom: 100,
    gap: 15,
    zIndex: 1,
  },
  postCard: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    marginHorizontal: 20,
        shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  postPremiumBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  userName: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  postTime: {
    fontFamily: 'Fredoka_400Regular',
  },
  postInfoText: {
    fontFamily: 'Fredoka_400Regular',
  },
  postBadges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  badgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  commentSection: {
    marginTop: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  commentTopBorder: {
    flex: 1,
    borderTopWidth: 1,
  },
  commentTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  postComment: {
    fontFamily: 'Fredoka_400Regular',
    lineHeight: 20,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCount: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  likeButtonTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
  },
  lineBadgeTopLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBadgeTopLeftText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 15,
    zIndex: 1,
  },
  emptyTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
  },
  quickFiltersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,

  },
  quickFiltersRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  quickFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickFilterText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  resetInfoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  resetInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetInfoText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
  },
});

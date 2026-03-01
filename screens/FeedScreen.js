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
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import ScreenGuide from '../components/ScreenGuide';
import { lignes } from '../data/lignes';
import { getCurrentUser, getUserData, incrementLikesCount, decrementLikesCount, incrementLikesGiven, decrementLikesGiven } from '../services/authService';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { setBadgeCount } from '../services/notificationService';
import { notifyLike, markAllNotificationsAsRead } from '../services/internalNotificationService';
import PremiumBadge from '../components/PremiumBadge';
import CommentsModal from '../components/CommentsModal';
import LikesModal from '../components/LikesModal';
import LikersPreview from '../components/LikersPreview';
import AnimatedMetroRefresh from '../components/AnimatedMetroRefresh';
import { formatUserName } from '../utils/formatUserName';
import { useResponsive } from '../utils/responsive';
import { usePremium } from '../context/PremiumContext';
import { submitReport } from '../services/reportService';

// Raisons de signalement
const REPORT_REASONS = [
  { key: 'spam', label: 'Spam ou hors-sujet' },
  { key: 'inappropriate', label: 'Contenu inapproprié' },
  { key: 'dangerous', label: 'Contenu dangereux' },
  { key: 'misinformation', label: 'Désinformation' },
];

// Modal de signalement (BottomSheet-style)
const ReportModal = ({ visible, onClose, onSubmit, theme, fontSize }) => {
  const [selectedReason, setSelectedReason] = useState(null);

  const handleClose = () => {
    setSelectedReason(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason);
    setSelectedReason(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={reportModalStyles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[reportModalStyles.sheet, { backgroundColor: theme.colors.background }]}
        >
          <View style={[reportModalStyles.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={[reportModalStyles.title, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Signaler ce contenu
          </Text>
          <Text style={[reportModalStyles.subtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
            Pourquoi souhaitez-vous signaler ce contenu ?
          </Text>

          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.key}
              style={[
                reportModalStyles.reasonRow,
                {
                  backgroundColor: selectedReason === reason.key
                    ? 'rgba(140, 233, 246, 0.15)'
                    : theme.colors.navbar,
                  borderColor: selectedReason === reason.key
                    ? '#8CE9F6'
                    : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedReason(reason.key)}
            >
              <Ionicons
                name={selectedReason === reason.key ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selectedReason === reason.key ? '#8CE9F6' : theme.colors.iconInactive}
              />
              <Text style={[reportModalStyles.reasonText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                {reason.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={reportModalStyles.buttons}>
            <TouchableOpacity
              style={[reportModalStyles.cancelButton, { borderColor: theme.colors.border }]}
              onPress={handleClose}
            >
              <Text style={[reportModalStyles.cancelText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
                Annuler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                reportModalStyles.submitButton,
                { backgroundColor: selectedReason ? '#FF6B6B' : theme.colors.border }
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason}
            >
              <Ionicons name="flag" size={16} color="#FFF" />
              <Text style={[reportModalStyles.submitText, { fontSize: fontSize.sizes.body }]}>
                Signaler
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const reportModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
    marginBottom: 4,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  reasonText: {
    fontFamily: 'Fredoka_400Regular',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'Fredoka_500Medium',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitText: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#FFF',
  },
});

// Composant de post animé
const AnimatedPostCard = ({ post, theme, fontSize, currentUser, onLike, onOpenComments, onOpenLikes, getSeverityColor, navigation, isPremium, onReport, reportedPosts }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const [imageLoaded, setImageLoaded] = useState(false);

  // Fonction helper pour formater le nom d'utilisateur
  const getFormattedUserName = (displayName, postUserId, userHideLastNames) => {
    if (!displayName) return 'Utilisateur';

    // Séparer le prénom et le nom
    const nameParts = displayName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return formatUserName(firstName, lastName, userHideLastNames, postUserId, currentUser?.uid);
  };

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

  // Obtenir le label de durée estimée
  const getDurationLabel = (duration) => {
    switch (duration) {
      case '15min':
        return '15 min';
      case '30min':
        return '30 min';
      case '1h':
        return '1 heure';
      case '2h':
        return '2 heures';
      case 'half_day':
        return 'Demi-journée';
      case 'full_day':
        return 'Journée';
      case 'unknown':
        return 'Durée inconnue';
      default:
        return null;
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

        {/* Boutons like et confirmer en haut à droite */}
        <View style={styles.topRightButtons}>
          <TouchableOpacity
            style={[styles.actionButtonTopRight, { backgroundColor: theme.colors.navbar }]}
            onPress={() => onLike(post)}
            disabled={isOwnPost}
          >
            <Ionicons
              name={hasLiked || isOwnPost ? "heart" : "heart-outline"}
              size={20}
              color={hasLiked || isOwnPost ? "#FF6B9D" : theme.colors.iconInactive}
            />
            <Text style={[styles.actionCount, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              {post.likesCount || 0}
            </Text>
          </TouchableOpacity>

          {/* Bouton signalement (masqué pour son propre post) */}
          {!isOwnPost && (
            <TouchableOpacity
              style={[styles.actionButtonTopRight, { backgroundColor: theme.colors.navbar }]}
              onPress={() => onReport({ contentType: 'post', contentId: post.id, postId: post.id })}
              disabled={reportedPosts?.has(post.id)}
            >
              <Ionicons
                name="flag-outline"
                size={18}
                color={reportedPosts?.has(post.id) ? '#FF6B6B' : theme.colors.iconInactive}
              />
            </TouchableOpacity>
          )}
        </View>

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
                {getFormattedUserName(post.userDisplayName, post.userId, post.userHideLastNames)}
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

              {/* Badge durée estimée */}
              {post.estimatedDuration && getDurationLabel(post.estimatedDuration) && (
                <View style={[
                  styles.badge,
                  {
                    backgroundColor: 'rgba(255, 149, 0, 0.15)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }
                ]}>
                  <Ionicons name="time-outline" size={12} color="#FF9500" />
                  <Text style={[styles.badgeText, { color: '#FF9500' }]}>
                    {getDurationLabel(post.estimatedDuration)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Section Commentaire */}
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

          {/* Bouton commentaires */}
          <TouchableOpacity
            style={[styles.commentsButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => onOpenComments(post)}
          >
            <Ionicons name="chatbubble-outline" size={18} color={theme.colors.iconActive} />
            <Text style={[styles.commentsButtonText, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              {post.commentsCount || 0} commentaire{(post.commentsCount || 0) > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>

          {/* Aperçu des likeurs */}
          <View style={{ alignItems: 'center' }}>
            <LikersPreview
              likedBy={post.likedBy}
              onPress={() => onOpenLikes(post)}
              theme={theme}
              fontSize={fontSize}
              isPremium={isPremium}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default function FeedScreen({ navigation }) {
  const { theme, fontSize } = useTheme();
  const { isTablet, maxContentWidth } = useResponsive();
  const { isPremium, refreshPremiumStatus } = usePremium();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = getCurrentUser();
  const flatListRef = useRef(null);

  // État pour le modal des commentaires
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // État pour le modal des likes
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [selectedPostForLikes, setSelectedPostForLikes] = useState(null);

  // État pour le signalement
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportedPosts, setReportedPosts] = useState(new Set());

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
  const [adModalVisible, setAdModalVisible] = useState(false);

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

  // Charger les préférences utilisateur (à chaque fois que la page est affichée)
  useFocusEffect(
    React.useCallback(() => {
      const loadUserPreferences = async () => {
        if (currentUser) {
          const result = await getUserData(currentUser.uid);
          if (result.success) {
            setUserPreferredLines(result.data.preferredLines || []);
            setUserPreferredStations(result.data.preferredStations || []);

            // Charger les villes sélectionnées (array) ou city (string pour rétro-compatibilité)
            let cities = result.data.cities || (result.data.city ? [result.data.city] : ['Paris']);

            // Si l'utilisateur n'est plus Premium mais a plusieurs villes, garder uniquement la première
            if (!isPremium && cities.length > 1) {
              cities = [cities[0]];
              // Mettre à jour Firestore
              await updateDoc(doc(db, 'users', currentUser.uid), {
                cities: cities,
                city: cities[0]
              });
              console.log('🏙️ Villes réduites à une seule (fin abonnement):', cities);
            }

            console.log('🏙️ Villes chargées dans FeedScreen:', cities);
            setUserCities(cities);

            // Afficher la pub si non premium
            if (!isPremium) {
              setAdModalVisible(true);
            }
          }
        }
      };
      loadUserPreferences();
    }, [currentUser, isPremium])
  );

  // Reset le badge count quand l'utilisateur arrive sur la page Feed
  useFocusEffect(
    React.useCallback(() => {
      setBadgeCount(0);

      // Marquer toutes les notifications internes comme lues
      if (currentUser?.uid) {
        markAllNotificationsAsRead(currentUser.uid);
      }
    }, [currentUser?.uid])
  );

  // Réagir aux changements de statut premium (géré par PremiumContext)
  useEffect(() => {
    const handlePremiumChange = async () => {
      if (currentUser) {
        // Si plus premium et plusieurs villes, réduire à une
        if (!isPremium && userCities.length > 1) {
          const firstCity = [userCities[0]];
          setUserCities(firstCity);
          await updateDoc(doc(db, 'users', currentUser.uid), {
            cities: firstCity,
            city: firstCity[0]
          });
          console.log('🏙️ Villes réduites à une seule (fin abonnement):', firstCity);
        }
      }
    };

    handlePremiumChange();
  }, [isPremium, currentUser, userCities]);

  // Scroller vers le haut quand on arrive sur la page
  useFocusEffect(
    React.useCallback(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
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
          likesCount: increment(-1),
          likedBy: arrayRemove(currentUser.uid),
        });
        // Décrémenter les likes de l'auteur
        await decrementLikesCount(post.userId);
        // Décrémenter les likes donnés par l'utilisateur courant
        await decrementLikesGiven(currentUser.uid);
      } else {
        // Like
        await updateDoc(postRef, {
          likesCount: increment(1),
          likedBy: arrayUnion(currentUser.uid),
        });
        // Incrémenter les likes de l'auteur
        await incrementLikesCount(post.userId);
        // Incrémenter les likes donnés par l'utilisateur courant
        await incrementLikesGiven(currentUser.uid);

        // Créer une notification pour l'auteur du post
        await notifyLike(
          post.userId,
          currentUser.uid,
          currentUser.displayName || 'Un utilisateur',
          currentUser.photoURL,
          post.id
        );
      }
    } catch (error) {
      console.error('Erreur lors du like:', error);
    }
  };

  // Ouvrir le modal des commentaires
  const handleOpenComments = (post) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
  };

  // Fermer le modal des commentaires
  const handleCloseComments = () => {
    setCommentsModalVisible(false);
    setSelectedPost(null);
  };

  // Ouvrir le modal des likes (Premium uniquement)
  const handleOpenLikes = (post) => {
    if (!isPremium) {
      navigation.navigate('Premium');
      return;
    }
    setSelectedPostForLikes(post);
    setLikesModalVisible(true);
  };

  // Fermer le modal des likes
  const handleCloseLikes = () => {
    setLikesModalVisible(false);
    setSelectedPostForLikes(null);
  };

  // Ouvrir le modal de signalement
  const handleOpenReport = (target) => {
    setReportTarget(target);
    setReportModalVisible(true);
  };

  // Soumettre un signalement
  const handleSubmitReport = async (reason) => {
    if (!reportTarget || !currentUser) return;

    setReportModalVisible(false);

    const result = await submitReport({
      contentType: reportTarget.contentType,
      contentId: reportTarget.contentId,
      postId: reportTarget.postId,
      reason,
      currentUser,
    });

    setReportTarget(null);

    if (result.alreadyReported) {
      Alert.alert('Déjà signalé', 'Vous avez déjà signalé ce contenu.');
    } else if (result.success) {
      setReportedPosts(prev => new Set([...prev, reportTarget.contentId]));
      Alert.alert('Signalement envoyé', 'Merci, votre signalement a bien été pris en compte.');
    } else {
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
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
    // Masquer les posts signalés (hidden)
    if (post.hidden === true) return false;

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
  const renderPost = ({ item: post }) => (
    <AnimatedPostCard
      post={post}
      theme={theme}
      fontSize={fontSize}
      currentUser={currentUser}
      onLike={handleLike}
      onOpenComments={handleOpenComments}
      onOpenLikes={handleOpenLikes}
      getSeverityColor={getSeverityColor}
      navigation={navigation}
      isPremium={isPremium}
      onReport={handleOpenReport}
      reportedPosts={reportedPosts}
    />
  );

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
        </View>
      )}

      {/* Information réinitialisation */}
      <View style={[styles.resetInfoContainer, { backgroundColor: theme.colors.navbar }]}>
        <View style={styles.resetInfoContent}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.iconActive} />
          <Text style={[styles.resetInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
            Les posts sont réinitialisés quotidiennement à 4h00
          </Text>
        </View>
      </View>

      {/* Liste des posts */}
      <FlatList
        ref={flatListRef}
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredPosts.length === 0 && styles.listContentEmpty,
          isTablet && { alignSelf: 'center', maxWidth: maxContentWidth },
          Platform.OS === 'android' && { paddingBottom: 150 },
        ]}
        ListHeaderComponent={
          filteredPosts.length > 0
            ? <AnimatedMetroRefresh refreshing={refreshing} theme={theme} />
            : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrapper, { backgroundColor: theme.colors.primary }]}>
              <Ionicons
                name={posts.length === 0 ? 'train-outline' : 'options-outline'}
                size={44}
                color="#1a1a1a"
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              {posts.length === 0 ? 'Aucun incident signalé' : 'Aucun résultat'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              {posts.length === 0
                ? 'Soyez le premier à partager une info trafic !'
                : 'Essayez de modifier vos filtres'}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={['transparent']}
          />
        }
      />

      {/* Modal des commentaires */}
      <CommentsModal
        visible={commentsModalVisible}
        onClose={handleCloseComments}
        post={selectedPost}
        navigation={navigation}
      />

      {/* Modal des likes */}
      <LikesModal
        visible={likesModalVisible}
        onClose={handleCloseLikes}
        likedBy={selectedPostForLikes?.likedBy}
        navigation={navigation}
      />

      {/* Modal de signalement */}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => { setReportModalVisible(false); setReportTarget(null); }}
        onSubmit={handleSubmitReport}
        theme={theme}
        fontSize={fontSize}
      />

      {/* Modal de publicité pour utilisateurs non-premium */}
      <Modal
        visible={adModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAdModalVisible(false)}
      >
        <View style={styles.adModalOverlay}>
          <View style={[styles.adModalContent, { backgroundColor: theme.colors.background }]}>
            {/* Icône Premium */}
            <View style={styles.adIconContainer}>
              <Ionicons name="diamond" size={60} color="#FFD700" />
            </View>

            {/* Titre */}
            <Text style={[styles.adTitle, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
              Profitez de toutes les fonctionnalités
            </Text>

            {/* Description */}
            <Text style={[styles.adDescription, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              Passez à Lini Premium pour seulement 2,99€/mois et débloquez toutes les fonctionnalités exclusives
            </Text>

            {/* Boutons */}
            <View style={styles.adButtonsContainer}>
              <TouchableOpacity
                style={[styles.adButtonPremium, { backgroundColor: '#FFD700' }]}
                onPress={() => {
                  setAdModalVisible(false);
                  navigation.navigate('Premium');
                }}
              >
                <Text style={[styles.adButtonPremiumText, { fontSize: fontSize.sizes.body }]}>
                  Devenir Premium
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.adButtonClose, { backgroundColor: theme.colors.navbar, borderColor: theme.colors.border }]}
                onPress={() => setAdModalVisible(false)}
              >
                <Text style={[styles.adButtonCloseText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  Continuer sans Premium
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ScreenGuide screenName="Feed" />
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
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
  },
  commentsButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCount: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  topRightButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'column',
    gap: 8,
    zIndex: 1,
  },
  actionButtonTopRight: {
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
  },
  actionCount: {
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
  listContentEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
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
  },
  quickFilterBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
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
  adModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  adModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  adIconContainer: {
    marginBottom: 20,
  },
  adTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
    marginBottom: 12,
  },
  adDescription: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  adButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  adButtonPremium: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  adButtonPremiumText: {
    color: '#000',
    fontFamily: 'Fredoka_600SemiBold',
  },
  adButtonClose: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  adButtonCloseText: {
    fontFamily: 'Fredoka_500Medium',
  },
});

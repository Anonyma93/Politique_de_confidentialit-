import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useWalkthrough, WALKTHROUGH_STEPS } from '../context/WalkthroughContext';
import WalkthroughTooltip from '../components/WalkthroughTooltip';
import { lignes } from '../data/lignes';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getCurrentUser } from '../services/authService';
import { registerForPushNotifications } from '../services/notificationService';
import { useFocusEffect } from '@react-navigation/native';

// Composant de titre personnalisé pour la page d'accueil
const HomeHeaderTitle = ({ theme, fontSize }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={headerStyles.container}>
      <Text style={[headerStyles.title, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
        En ce moment
      </Text>
      <View style={headerStyles.liveBadge}>
        <Animated.View
          style={[
            headerStyles.liveIndicator,
            { transform: [{ scale: pulseAnim }] }
          ]}
        />
        <Text style={headerStyles.liveText}>LIVE</Text>
      </View>
    </View>
  );
};

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,

  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Fredoka_700Bold',
    letterSpacing: 0.5,
  },
});

export default function HomePage({ navigation }) {
  const { theme, fontSize } = useTheme();
  const currentUser = getCurrentUser();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCities, setUserCities] = useState(['Paris']); // Villes sélectionnées par l'utilisateur
  const scrollViewRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const metricAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const linesAnim = useRef(new Animated.Value(0)).current;
  const topPostAnim = useRef(new Animated.Value(0)).current;
  const emptyStateBounce = useRef(new Animated.Value(0)).current;

  // Enregistrer le token FCM pour les notifications push au démarrage
  useEffect(() => {
    if (currentUser) {
      console.log('📱 Enregistrement du token FCM pour l\'utilisateur:', currentUser.uid);
      registerForPushNotifications(currentUser.uid);
    }
  }, [currentUser]);

  // Charger les villes sélectionnées par l'utilisateur (à chaque fois que la page est affichée)
  useFocusEffect(
    React.useCallback(() => {
      const loadUserCities = async () => {
        if (currentUser) {
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              // Utiliser cities (array) ou city (string pour rétro-compatibilité)
              const cities = userData.cities || (userData.city ? [userData.city] : ['Paris']);
              setUserCities(cities);
            }
          } catch (error) {
            console.error('Erreur lors du chargement des villes:', error);
          }
        }
      };

      loadUserCities();
    }, [currentUser])
  );

  // Scroller vers le haut quand on arrive sur la page
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
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

  // Déclencher les animations après le chargement
  useEffect(() => {
    if (!loading) {
      // Animation d'entrée globale
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();

      // Animations échelonnées des cartes métriques
      Animated.stagger(100, metricAnims.map(anim =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        })
      )).start();

      // Animation des lignes impactées
      Animated.timing(linesAnim, {
        toValue: 1,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }).start();

      // Animation du post populaire
      Animated.spring(topPostAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 400,
        useNativeDriver: true,
      }).start();

      // Animation pulsante pour l'icône de validation
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(emptyStateBounce, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(emptyStateBounce, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }
  }, [loading]);

  // Filtrer les posts par ville
  const getFilteredPostsByCity = () => {
    return posts.filter(post => {
      const postCity = post.city || 'Paris'; // Par défaut Paris si non défini
      return userCities.includes(postCity);
    });
  };

  // Calculer les posts de la dernière heure
  const getPostsLastHour = () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const filteredPosts = getFilteredPostsByCity();
    return filteredPosts.filter(post => post.createdAt >= oneHourAgo);
  };

  // Calculer les posts d'aujourd'hui
  const getPostsToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const filteredPosts = getFilteredPostsByCity();
    return filteredPosts.filter(post => post.createdAt >= todayISO);
  };

  // Lignes impactées dans la dernière heure (exclut gravité Sans et Minime, et les posts info)
  const getImpactedLines = () => {
    const postsLastHour = getPostsLastHour();
    // Filtrer les posts avec gravité différente de 'sans' et 'minime', et exclure les posts de type 'info'
    const significantPosts = postsLastHour.filter(post =>
      post.postType !== 'info' && post.severity !== 'sans' && post.severity !== 'minime'
    );
    const uniqueLines = [...new Set(significantPosts.map(post => post.line))];
    return uniqueLines.map(lineValue => lignes.find(l => l.value === lineValue)).filter(Boolean);
  };

  // Post avec le plus de likes
  const getTopPost = () => {
    const filteredPosts = getFilteredPostsByCity();
    if (filteredPosts.length === 0) return null;
    return filteredPosts.reduce((max, post) => (post.likesCount > max.likesCount ? post : max), filteredPosts[0]);
  };

  // Métriques du jour
  const getTodayMetrics = () => {
    const postsToday = getPostsToday();
    const uniqueLines = [...new Set(postsToday.map(post => post.line))];
    const uniqueStations = [...new Set(postsToday.map(post => post.station))];

    return {
      postsCount: postsToday.length,
      linesCount: uniqueLines.length,
      stationsCount: uniqueStations.length,
    };
  };

  const impactedLines = getImpactedLines();
  const topPost = getTopPost();
  const metrics = getTodayMetrics();

  // Formater la date
  const formatDate = (isoString) => {
    const date = new Date(isoString);
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

  // Obtenir la couleur de gravité
  const getSeverityColor = (severity) => {
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.iconActive} />
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

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* En-tête */}
        <WalkthroughTooltip
          stepId={WALKTHROUGH_STEPS.HOME.INTRODUCTION}
          title="Page d'accueil"
          content="Elle permet de résumer les principales informations au cours de la journée comme le nombre de posts, la quantité de lignes et d'arrêts affectés."
          placement="bottom"
        >
          <View style={[styles.headerContainer, { backgroundColor: theme.colors.backgroundPage }]}>
            <HomeHeaderTitle theme={theme} fontSize={fontSize} />
          </View>
        </WalkthroughTooltip>

        {/* Métriques du jour */}
      <Animated.View
        style={[
          styles.section,
          {
            backgroundColor: theme.colors.background,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Aujourd'hui
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Statistiques du jour
            </Text>
          </View>
        </View>
        <View style={[styles.metricsContainer, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
          <Animated.View
            style={[
              styles.metricCard,
              { backgroundColor: theme.colors.cardBackgroundColor },
              {
                opacity: metricAnims[0],
                transform: [{ scale: metricAnims[0] }],
              }
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ffffff20' }]}>
              <Ionicons name="newspaper-outline" size={24} color="#4CAF50" />
            </View>
            <Text style={[styles.metricValue, { color: '#FFFFFF', fontSize: fontSize.sizes.title }]}>
              {metrics.postsCount}
            </Text>
            <Text style={[styles.metricLabel, { color: '#FFFFFF', fontSize: fontSize.sizes.small }]}>
              Post{metrics.postsCount > 1 ? 's' : ''}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.metricCard,
              { backgroundColor: theme.colors.cardBackgroundColor },
              {
                opacity: metricAnims[1],
                transform: [{ scale: metricAnims[1] }],
              }
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ffffff20' }]}>
              <Ionicons name="subway" size={24} color="#6C5CE7" />
            </View>
            <Text style={[styles.metricValue, { color: '#FFFFFF', fontSize: fontSize.sizes.title }]}>
              {metrics.linesCount}
            </Text>
            <Text style={[styles.metricLabel, { color: '#FFFFFF', fontSize: fontSize.sizes.small }]}>
              Ligne{metrics.linesCount > 1 ? 's' : ''}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.metricCard,
              { backgroundColor: theme.colors.cardBackgroundColor },
              {
                opacity: metricAnims[2],
                transform: [{ scale: metricAnims[2] }],
              }
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ffffff20' }]}>
              <Ionicons name="location" size={24} color="#FF6B9D" />
            </View>
            <Text style={[styles.metricValue, { color: '#FFFFFF', fontSize: fontSize.sizes.title }]}>
              {metrics.stationsCount}
            </Text>
            <Text style={[styles.metricLabel, { color: '#FFFFFF', fontSize: fontSize.sizes.small }]}>
              Gare{metrics.stationsCount > 1 ? 's' : ''}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Lignes impactées dernière heure */}
      <Animated.View
        style={[
          styles.section,
          {
            backgroundColor: theme.colors.background,
            opacity: linesAnim,
            transform: [{
              translateX: linesAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              })
            }],
          }
        ]}
      >
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Lignes impactées
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Dernière heure
            </Text>
          </View>
        </View>

        <WalkthroughTooltip
          stepId={WALKTHROUGH_STEPS.HOME.IMPACTED_LINES}
          previousStepId={WALKTHROUGH_STEPS.HOME.INTRODUCTION}
          title="Lignes impactées"
          content="Cette section affiche les lignes de transport avec des incidents signalés dans la dernière heure. Vous pouvez voir en un coup d'œil quelles lignes sont perturbées."
          placement="top"
        >
          <View style={[styles.impactedLinesCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
            {impactedLines.length > 0 ? (
              <View style={styles.linesContainer}>
                {impactedLines.map((ligne) => (
                  <View
                    key={ligne.value}
                    style={[styles.lineBadge, { backgroundColor: ligne.backgroundColor }]}
                  >
                    <Text style={[styles.lineBadgeText, { color: ligne.color }]}>
                      {ligne.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Animated.View
                  style={[
                    styles.celebrationIconContainer,
                    {
                      transform: [
                        {
                          scale: emptyStateBounce.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.15],
                          })
                        },
                        {
                          rotate: emptyStateBounce.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: ['0deg', '-5deg', '0deg'],
                          })
                        }
                      ],
                    }
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                </Animated.View>
                <Text style={[styles.emptyText, { fontSize: fontSize.sizes.subtitle }]}>
                  Aucun incident signalé
                </Text>
                <Text style={[styles.emptySubtext, { fontSize: fontSize.sizes.body }]}>
                  🎉 Tout roule !
                </Text>
              </View>
            )}
          </View>
        </WalkthroughTooltip>
      </Animated.View>

      {/* Post avec le plus de likes */}
      {topPost && topPost.likesCount > 0 && (
        <Animated.View
          style={[
            styles.section,
            {
              backgroundColor: 'theme.colors.background',
              opacity: topPostAnim,
              transform: [{ scale: topPostAnim }],
            }
          ]}
        >
          <View style={styles.sectionTitleContainer}>
            <View style={styles.titleAccent} />
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Post le plus populaire
              </Text>
              <View style={styles.likesIndicator}>
                <Ionicons name="heart" size={14} color="#FF6B9D" />
                <Text style={[styles.likesCount, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  {topPost.likesCount} like{topPost.likesCount > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          <View style={[
            styles.postCard,
            {
              backgroundColor: theme.colors.post,
              borderLeftColor: getSeverityColor(topPost.severity),
              borderRightColor: getSeverityColor(topPost.severity),
              borderTopColor: getSeverityColor(topPost.severity),
              borderBottomColor: getSeverityColor(topPost.severity),
            }
          ]}>
            {/* Badge ligne en haut à gauche */}
            {(() => {
              const ligne = lignes.find(l => l.value === topPost.line);
              return ligne ? (
                <View style={[styles.lineBadgeTopLeft, { backgroundColor: ligne.backgroundColor }]}>
                  <Text style={[styles.lineBadgeTopLeftText, { color: ligne.color, fontSize: fontSize.sizes.small }]}>
                    {ligne.label}
                  </Text>
                </View>
              ) : null;
            })()}

            {/* Bouton like en haut à droite */}
            <View style={[styles.likeButtonTopRight, { backgroundColor: theme.colors.navbar }]}>
              <Ionicons name="heart" size={20} color="#FF6B9D" />
              <Text style={[styles.likeCount, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                {topPost.likesCount}
              </Text>
            </View>

            {/* Header du post */}
            <View style={styles.postHeader}>
              <View style={{ alignItems: 'center', width: '100%' }}>
                {/* Photo de profil */}
                <TouchableOpacity
                  onPress={() => topPost.userId !== currentUser?.uid && navigation.navigate('UserProfile', { userId: topPost.userId })}
                  activeOpacity={topPost.userId === currentUser?.uid ? 1 : 0.7}
                >
                  {topPost.userPhotoURL ? (
                    <Image
                      source={{ uri: topPost.userPhotoURL }}
                      style={styles.avatar}
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
                </TouchableOpacity>

                {/* Nom */}
                <TouchableOpacity
                  onPress={() => topPost.userId !== currentUser?.uid && navigation.navigate('UserProfile', { userId: topPost.userId })}
                  activeOpacity={topPost.userId === currentUser?.uid ? 1 : 0.7}
                >
                  <Text style={[styles.userName, { color: theme.colors.text, fontSize: fontSize.sizes.body, marginTop: 8 }]}>
                    {topPost.userDisplayName || 'Utilisateur'}
                    {topPost.userId === currentUser?.uid && (
                      <Text style={{ color: theme.colors.iconActive }}> (Vous)</Text>
                    )}
                  </Text>
                </TouchableOpacity>

                {/* Gare et direction */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Ionicons name="location" size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.postInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginLeft: 4 }]}>
                    {topPost.station}
                  </Text>
                  <Text style={[styles.postInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginHorizontal: 6 }]}>
                    -
                  </Text>
                  <Ionicons name="navigate" size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.postInfoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginLeft: 4 }]}>
                    {topPost.direction}
                  </Text>
                </View>

                {/* Badges */}
                <View style={[styles.postBadges, { marginTop: 8, justifyContent: 'center' }]}>
                  {/* Badge gravité */}
                  <View style={[
                    styles.badge,
                    {
                      backgroundColor: getSeverityColor(topPost.severity),
                    }
                  ]}>
                    <Text style={[styles.badgeText, { color: topPost.severity === 'interrompu' ? '#FFF' : '#000' }]}>
                      {getSeverityLabel(topPost.severity)}
                    </Text>
                  </View>

                  {/* Badge incident */}
                  <View style={[
                    styles.badge,
                    {
                      backgroundColor: theme.colors.primary,
                    }
                  ]}>
                    <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                      {topPost.incident}
                    </Text>
                  </View>
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
                {topPost.comment}
              </Text>
              <Text style={[styles.postTime, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, textAlign: 'center', marginTop: 8 }]}>
                {formatDate(topPost.createdAt)}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
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
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    height: 120,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 20,
    paddingTop: 15,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  sectionSubtitle: {
    fontFamily: 'Fredoka_400Regular',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricCard: {
    flex: 1,
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(201, 242, 223, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  metricLabel: {
    fontFamily: 'Fredoka_400Regular',
  },
  impactedLinesCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  linesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  lineBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
  },
  celebrationIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF5015',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#4CAF50',
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#4CAF50',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  likesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesCount: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  popularBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 242, 223, 0.2)',
  },
  timeText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  postCard: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 12,
    borderWidth: 2,
    borderRadius: 16,
    marginHorizontal: 0,
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
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
  userName: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  postTime: {
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
  postInfo: {
    gap: 6,
  },
  postInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postInfoText: {
    fontFamily: 'Fredoka_400Regular',
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
});

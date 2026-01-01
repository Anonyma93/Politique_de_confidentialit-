import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getUserData } from '../services/authService';
import { lignes } from '../data/lignes';

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { theme, fontSize } = useTheme();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedLines, setSelectedLines] = useState([]);
  const [selectedStations, setSelectedStations] = useState([]);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    setLoading(true);
    const result = await getUserData(userId);
    if (result.success) {
      setUserData(result.data);

      // Charger les lignes préférées
      if (Array.isArray(result.data.preferredLines)) {
        setSelectedLines(result.data.preferredLines);
      } else if (typeof result.data.preferredLines === 'string' && result.data.preferredLines) {
        setSelectedLines(result.data.preferredLines.split(',').map(l => l.trim()).filter(l => l));
      }

      // Charger les stations préférées
      if (Array.isArray(result.data.preferredStations)) {
        setSelectedStations(result.data.preferredStations);
      } else if (typeof result.data.preferredStations === 'string' && result.data.preferredStations) {
        setSelectedStations(result.data.preferredStations.split(',').map(s => s.trim()).filter(s => s));
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.iconActive} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* En-tête avec photo */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          {/* Bouton retour */}
          <TouchableOpacity
            style={[styles.backButtonInHeader, { backgroundColor: theme.colors.background }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>

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
              </View>
            </View>

            <View style={styles.nameSection}>
              <Text style={[styles.displayName, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
                {userData?.firstName} {userData?.lastName}
              </Text>

              {/* Grade de l'utilisateur */}
              <View style={[
                styles.gradeBadge,
                {
                  backgroundColor: theme.name === 'light' ? '#F5F5F5' : theme.colors.cardBackgroundColor,
                  borderColor: theme.colors.border,
                  borderWidth: 1
                }
              ]}>
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
              </View>
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
          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="person-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Prénom
              </Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                {userData?.firstName}
              </Text>
            </View>
          </View>

          {/* Nom de famille */}
          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="person-circle-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Nom de famille
              </Text>
              <Text style={[styles.fieldValue, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                {userData?.lastName}
              </Text>
            </View>
          </View>
        </View>

        {/* Lignes préférées */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleContainer, { marginBottom: 12 }]}>
            <View style={styles.titleAccent} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Lignes préférées
            </Text>
          </View>

          <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="train-outline" size={22} color="#fff" />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 0, marginTop: 0 }]}>
                Ses lignes
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
          </View>
        </View>

        {/* Stations préférées */}
        {selectedStations.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionTitleContainer, { marginBottom: 12 }]}>
              <View style={styles.titleAccent} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Stations / Gares préférées
              </Text>
            </View>

            <View style={[styles.fieldCard, { backgroundColor: theme.colors.post }]}>
              <View style={[styles.fieldIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
                <Ionicons name="location-outline" size={22} color="#fff" />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 0, marginTop: 0 }]}>
                  Ses stations / gares
                </Text>
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
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonInHeader: {
    position: 'absolute',
    top: 70,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingTop: 90,
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
    gap: 6,
  },
  gradeText: {
    color: '#fff',
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
  fieldLabel: {
    fontFamily: 'Fredoka_400Regular',
    marginBottom: 0,
    marginTop: 0,
  },
  fieldValue: {
    fontFamily: 'Fredoka_500Medium',
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
    minWidth: 70,
  },
  badgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
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
});

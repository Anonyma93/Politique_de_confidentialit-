import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUser, getUserData } from '../services/authService';
import PremiumBadge from './PremiumBadge';
import { formatUserName } from '../utils/formatUserName';

// Composant pour un utilisateur individuel
const UserItem = ({ user, index, theme, fontSize, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        style={[styles.userItem, { backgroundColor: theme.colors.navbar }]}
        onPress={() => onPress(user.uid)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {user.photoURL ? (
            <Image
              source={{ uri: user.photoURL }}
              style={styles.userAvatar}
            />
          ) : (
            <LinearGradient
              colors={['#E0E0E0', '#BDBDBD']}
              style={[styles.userAvatar, styles.defaultAvatar]}
            >
              <Ionicons name="person" size={20} color="#FFF" />
            </LinearGradient>
          )}
          {user.isPremium && (
            <View style={styles.premiumBadgePosition}>
              <PremiumBadge size={16} />
            </View>
          )}
        </View>

        {/* Nom */}
        <View style={styles.userInfo}>
          <Text
            style={[
              styles.userName,
              { color: theme.colors.text, fontSize: fontSize.sizes.body },
            ]}
            numberOfLines={1}
          >
            {user.displayName}
          </Text>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function LikesModal({ visible, onClose, likedBy, navigation }) {
  const { theme, fontSize } = useTheme();
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger les données des utilisateurs qui ont liké
  useEffect(() => {
    if (!visible || !likedBy || likedBy.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const loadUsers = async () => {
      setLoading(true);
      const usersData = [];

      for (const userId of likedBy) {
        const result = await getUserData(userId);
        if (result.success) {
          const data = result.data;
          const firstName = data.firstName || '';
          const lastName = data.lastName || '';
          const hideLastNames = data.hideLastNames || false;

          usersData.push({
            uid: userId,
            displayName: formatUserName(firstName, lastName, hideLastNames, userId, currentUser?.uid),
            photoURL: data.photoURL || null,
            isPremium: data.isPremium || false,
          });
        }
      }

      setUsers(usersData);
      setLoading(false);
    };

    loadUsers();
  }, [visible, likedBy, currentUser?.uid]);

  // Naviguer vers le profil utilisateur
  const handleUserPress = (userId) => {
    if (!navigation || !userId) return;

    onClose();

    setTimeout(() => {
      navigation.navigate('UserProfile', { userId });
    }, 300);
  };

  const renderUser = ({ item, index }) => (
    <UserItem
      user={item}
      index={index}
      theme={theme}
      fontSize={fontSize}
      onPress={handleUserPress}
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          {/* Header avec gradient */}
          <LinearGradient
            colors={theme.name === 'dark' ? ['#1A1A1A', theme.colors.navbar] : ['#FFFFFF', theme.colors.navbar]}
            style={styles.modalHeader}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={[styles.likesBadge, { backgroundColor: '#FF6B9D' }]}>
                  <Ionicons name="heart" size={18} color="#FFF" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                    Likes
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                    {likedBy?.length || 0} {(likedBy?.length || 0) > 1 ? 'personnes' : 'personne'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={32} color={theme.colors.iconInactive} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Liste des utilisateurs */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.iconActive} />
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <LinearGradient
                colors={['#FF6B9D', '#FF8E53']}
                style={styles.emptyIcon}
              >
                <Ionicons name="heart" size={48} color="#FFF" />
              </LinearGradient>
              <Text style={[styles.emptyText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Aucun like pour le moment
              </Text>
              <Text style={[styles.emptySubText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Les likes apparaitront ici
              </Text>
            </View>
          ) : (
            <FlatList
              data={users}
              renderItem={renderUser}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={styles.usersList}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  likesBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  modalSubtitle: {
    fontFamily: 'Fredoka_400Regular',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyText: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  emptySubText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
  },
  usersList: {
    padding: 16,
    gap: 10,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBadgePosition: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Fredoka_600SemiBold',
  },
});

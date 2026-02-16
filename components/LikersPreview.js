import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserData } from '../services/authService';
import PremiumBadge from './PremiumBadge';

const MAX_AVATARS = 3;

export default function LikersPreview({ likedBy, onPress, theme, fontSize, isPremium }) {
  const [likerAvatars, setLikerAvatars] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!likedBy || likedBy.length === 0) {
      setLikerAvatars([]);
      setLoaded(true);
      return;
    }

    const loadAvatars = async () => {
      const avatars = [];
      const idsToFetch = likedBy.slice(0, MAX_AVATARS);

      for (const userId of idsToFetch) {
        const result = await getUserData(userId);
        if (result.success) {
          avatars.push({
            uid: userId,
            photoURL: result.data.photoURL || null,
          });
        }
      }

      setLikerAvatars(avatars);
      setLoaded(true);
    };

    loadAvatars();
  }, [likedBy]);

  if (!likedBy || likedBy.length === 0 || !loaded) return null;

  const totalLikes = likedBy.length;
  const remaining = totalLikes - likerAvatars.length;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatars empilés */}
      <View style={styles.avatarsStack}>
        {likerAvatars.map((liker, index) => (
          <View
            key={liker.uid}
            style={[
              styles.avatarWrapper,
              { marginLeft: index === 0 ? 0 : -10, zIndex: MAX_AVATARS - index },
            ]}
          >
            {liker.photoURL ? (
              <Image
                source={{ uri: liker.photoURL }}
                style={[styles.miniAvatar, { borderColor: theme.colors.post }]}
              />
            ) : (
              <LinearGradient
                colors={['#E0E0E0', '#BDBDBD']}
                style={[styles.miniAvatar, styles.defaultAvatar, { borderColor: theme.colors.post }]}
              >
                <Ionicons name="person" size={10} color="#FFF" />
              </LinearGradient>
            )}
          </View>
        ))}
      </View>

      {/* Texte */}
      <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
        {totalLikes === 1
          ? 'Aimé par 1 personne'
          : `Aimé par ${totalLikes} personnes`}
      </Text>

      {/* Badge Premium si non premium */}
      {!isPremium && (
        <PremiumBadge size={18} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  avatarsStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    // for stacking overlap
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Fredoka_500Medium',
  },
});

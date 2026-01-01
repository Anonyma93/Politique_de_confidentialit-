import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Badge Premium à afficher sur les avatars
 * @param {object} props
 * @param {number} props.size - Taille du badge (par défaut: 24)
 * @param {object} props.style - Styles additionnels
 */
export default function PremiumBadge({ size = 24, style }) {
  const iconSize = size * 0.65;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <LinearGradient
        colors={['#FFD700', '#FFA500']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Ionicons
          name="diamond"
          size={iconSize}
          color="#FFFFFF"
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  gradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
